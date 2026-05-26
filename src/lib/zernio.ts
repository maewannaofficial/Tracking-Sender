import type { ZernioConversationCandidate } from "@/types/order";

const ZERNIO_API_BASE = "https://zernio.com/api";
const CONVERSATION_CACHE_MS = 2 * 60 * 1000;
const MESSAGE_SCAN_LIMIT = 25;

function getApiKey() {
  const apiKey = process.env.ZERNIO_API_KEY;
  if (!apiKey) {
    throw new Error("ZERNIO_API_KEY is required");
  }
  return apiKey;
}

function getAccountId() {
  const accountId = process.env.ZERNIO_ACCOUNT_ID;
  if (!accountId) {
    throw new Error("ZERNIO_ACCOUNT_ID is required");
  }
  return accountId;
}

async function zernioRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${ZERNIO_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      typeof payload?.error === "string"
        ? payload.error
        : typeof payload?.message === "string"
          ? payload.message
          : `Zernio request failed with ${response.status}`;
    throw new Error(message);
  }

  return payload as T;
}

export type ZernioIntelligenceQuery = {
  fromDate?: string;
  toDate?: string;
  platform?: string;
  accountId?: string;
};

type SearchableConversation = ZernioConversationCandidate & {
  searchableText: string;
};

let searchableConversationCache:
  | { expiresAt: number; conversations: SearchableConversation[] }
  | null = null;

export function clearZernioConversationCacheForTests() {
  searchableConversationCache = null;
}

function appendOptionalParams(params: URLSearchParams, query: ZernioIntelligenceQuery) {
  if (query.fromDate) params.set("fromDate", query.fromDate);
  if (query.toDate) params.set("toDate", query.toDate);
  if (query.platform && query.platform !== "all") params.set("platform", query.platform);
  if (query.accountId) params.set("accountId", query.accountId);
}

function candidateName(candidate: Record<string, unknown>) {
  const value =
    candidate.participantName ??
    candidate.name ??
    candidate.displayIdentifier ??
    candidate.participantId;

  return typeof value === "string" ? value.trim() : "";
}

function normalizeSearchText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function bestMatchedName(searchName: string, conversation: ZernioConversationCandidate, searchableText: string) {
  if (conversation.name && conversation.name !== "Facebook User") {
    return conversation.name;
  }

  const normalizedSearchName = searchName.trim();
  const regex = new RegExp(`(?:fb|facebook)\\s*[:：]\\s*(${escapeRegex(normalizedSearchName)})`, "i");
  const match = searchableText.match(regex);
  return match?.[1]?.trim() || normalizedSearchName || conversation.name;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeConversation(candidate: Record<string, unknown>) {
  const conversationValue = candidate.id ?? candidate.conversationId ?? candidate.conversation_id;
  const accountValue = candidate.accountId ?? candidate.account_id ?? process.env.ZERNIO_ACCOUNT_ID;

  if (conversationValue === undefined || conversationValue === null) {
    return null;
  }

  return {
    conversation_id: String(conversationValue),
    account_id: accountValue === undefined || accountValue === null ? "" : String(accountValue),
    name: candidateName(candidate) || String(conversationValue),
    platform: typeof candidate.platform === "string" ? candidate.platform : "",
  } satisfies ZernioConversationCandidate;
}

export function extractZernioConversations(payload: unknown): ZernioConversationCandidate[] {
  const container = payload as Record<string, unknown>;
  const candidates =
    (Array.isArray(container.data) && container.data) ||
    (Array.isArray(container.conversations) && container.conversations) ||
    [];

  return candidates.flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object") {
      return [];
    }

    const normalized = normalizeConversation(candidate as Record<string, unknown>);
    return normalized ? [normalized] : [];
  });
}

async function getConversationMessages(conversationId: string, accountId: string) {
  const params = new URLSearchParams({
    accountId,
    limit: "20",
    sortOrder: "desc",
  });
  const payload = await zernioRequest(`/v1/inbox/conversations/${encodeURIComponent(conversationId)}/messages?${params.toString()}`);
  const container = payload as Record<string, unknown>;
  return Array.isArray(container.messages) ? container.messages : [];
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<R>,
) {
  const results: R[] = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const currentIndex = index;
      index += 1;
      results[currentIndex] = await mapper(items[currentIndex]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function getSearchableConversations(seedConversations?: ZernioConversationCandidate[]) {
  const now = Date.now();
  if (searchableConversationCache && searchableConversationCache.expiresAt > now) {
    return searchableConversationCache.conversations;
  }

  const conversations =
    seedConversations ??
    extractZernioConversations(
      await zernioRequest(
        `/v1/inbox/conversations?${new URLSearchParams({
          platform: process.env.ZERNIO_PLATFORM ?? "facebook",
          status: "active",
          limit: "100",
          sortOrder: "desc",
        }).toString()}`,
      ),
    );

  const searchableConversations = await mapWithConcurrency(conversations.slice(0, MESSAGE_SCAN_LIMIT), 2, async (conversation) => {
    const messages = await getConversationMessages(conversation.conversation_id, conversation.account_id).catch(() => []);
    const messageText = messages
      .filter((message) => message && typeof message === "object")
      .map((message) => {
        const row = message as Record<string, unknown>;
        return [row.senderName, row.message, row.subject].filter((value) => typeof value === "string").join(" ");
      })
      .join(" ");

    return {
      ...conversation,
      searchableText: [conversation.name, messageText].join(" "),
    };
  });

  searchableConversationCache = {
    expiresAt: now + CONVERSATION_CACHE_MS,
    conversations: searchableConversations,
  };
  return searchableConversations;
}

export async function findConversationsByName(name: string) {
  const params = new URLSearchParams({
    platform: process.env.ZERNIO_PLATFORM ?? "facebook",
    status: "active",
    limit: "100",
  });
  const payload = await zernioRequest(`/v1/inbox/conversations?${params.toString()}`);
  const normalizedName = name.trim().toLowerCase();
  const conversations = extractZernioConversations(payload);

  const directMatches = conversations.filter((conversation) =>
    conversation.name.toLowerCase().includes(normalizedName),
  );
  if (directMatches.length > 0) {
    return directMatches;
  }

  const normalizedSearchName = normalizeSearchText(name);
  return (await getSearchableConversations(conversations))
    .filter((conversation) => normalizeSearchText(conversation.searchableText).includes(normalizedSearchName))
    .map((conversation) => ({
      conversation_id: conversation.conversation_id,
      account_id: conversation.account_id,
      name: bestMatchedName(name, conversation, conversation.searchableText),
      platform: conversation.platform,
    }));
}

export async function sendZernioInboxMessage(conversationId: string, message: string) {
  const accountId = getAccountId();

  return zernioRequest(`/v1/inbox/conversations/${encodeURIComponent(conversationId)}/messages`, {
    method: "POST",
    body: JSON.stringify({
      accountId,
      message,
      messagingType: "MESSAGE_TAG",
      messageTag: process.env.ZERNIO_MESSAGE_TAG ?? "POST_PURCHASE_UPDATE",
    }),
  });
}

export async function getZernioAdCampaigns(query: ZernioIntelligenceQuery = {}) {
  const params = new URLSearchParams({
    source: "all",
    limit: "100",
  });
  appendOptionalParams(params, query);

  return zernioRequest(`/v1/ads/campaigns?${params.toString()}`);
}

export async function getZernioPostAnalytics(query: ZernioIntelligenceQuery = {}) {
  const params = new URLSearchParams({
    source: "all",
    limit: "100",
    sortBy: "engagement",
    order: "desc",
  });
  appendOptionalParams(params, query);

  return zernioRequest(`/v1/analytics?${params.toString()}`);
}
