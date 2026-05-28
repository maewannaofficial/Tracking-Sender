import type { ZernioConversationCandidate } from "@/types/order";

const ZERNIO_API_BASE = "https://zernio.com/api";
const DEFAULT_CONVERSATION_MATCH_PAGE_LIMIT = 10;
const DEFAULT_CONVERSATION_CACHE_TTL_MS = 60_000;

type ConversationCacheEntry = {
  key: string;
  expiresAt: number;
  conversations: ZernioConversationCandidate[];
};

let conversationCache: ConversationCacheEntry | null = null;
let conversationCachePromise: Promise<ConversationCacheEntry> | null = null;

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

function getConversationMatchPageLimit() {
  const parsed = Number(process.env.ZERNIO_MATCH_MAX_PAGES ?? DEFAULT_CONVERSATION_MATCH_PAGE_LIMIT);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : DEFAULT_CONVERSATION_MATCH_PAGE_LIMIT;
}

function getConversationCacheTtlMs() {
  const parsed = Number(process.env.ZERNIO_CONVERSATION_CACHE_TTL_MS ?? DEFAULT_CONVERSATION_CACHE_TTL_MS);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : DEFAULT_CONVERSATION_CACHE_TTL_MS;
}

function getConversationCacheKey() {
  return JSON.stringify({
    platform: process.env.ZERNIO_PLATFORM ?? "facebook",
    status: "active",
    pageLimit: getConversationMatchPageLimit(),
  });
}

function normalizeNameForMatch(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "");
}

function conversationNameMatches(candidateNameValue: string, searchName: string) {
  const candidate = normalizeNameForMatch(candidateNameValue);
  const search = normalizeNameForMatch(searchName);

  return Boolean(search && candidate.includes(search));
}

async function fetchConversationPages() {
  const conversations: ZernioConversationCandidate[] = [];
  let cursor = "";

  for (let page = 0; page < getConversationMatchPageLimit(); page += 1) {
    const params = new URLSearchParams({
      platform: process.env.ZERNIO_PLATFORM ?? "facebook",
      status: "active",
      limit: "100",
      sortOrder: "desc",
    });
    if (cursor) {
      params.set("cursor", cursor);
    }

    const payload = await zernioRequest(`/v1/inbox/conversations?${params.toString()}`);
    const container = payload as Record<string, unknown>;
    const pagination = container.pagination as Record<string, unknown> | undefined;
    conversations.push(...extractZernioConversations(payload));

    const nextCursor = typeof pagination?.nextCursor === "string" ? pagination.nextCursor : "";
    if (!pagination?.hasMore || !nextCursor) {
      break;
    }
    cursor = nextCursor;
  }

  return conversations;
}

async function getCachedConversationPages() {
  const cacheKey = getConversationCacheKey();
  const now = Date.now();

  if (conversationCache?.key === cacheKey && conversationCache.expiresAt > now) {
    return conversationCache.conversations;
  }

  if (conversationCachePromise) {
    const entry = await conversationCachePromise;
    if (entry.key === cacheKey && entry.expiresAt > Date.now()) {
      return entry.conversations;
    }
  }

  conversationCachePromise = fetchConversationPages()
    .then((conversations) => {
      const entry = {
        key: cacheKey,
        expiresAt: Date.now() + getConversationCacheTtlMs(),
        conversations,
      };
      conversationCache = entry;
      return entry;
    })
    .finally(() => {
      conversationCachePromise = null;
    });

  const entry = await conversationCachePromise;
  return entry.conversations;
}

export function clearZernioConversationCache() {
  conversationCache = null;
  conversationCachePromise = null;
}

export async function findConversationsByName(name: string) {
  const conversations = await getCachedConversationPages();

  return conversations.filter((conversation) => conversationNameMatches(conversation.name, name));
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
