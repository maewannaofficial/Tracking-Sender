import type { ZernioConversationCandidate } from "@/types/order";

const ZERNIO_API_BASE = "https://zernio.com/api";

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

export async function findConversationsByName(name: string) {
  const params = new URLSearchParams({
    platform: process.env.ZERNIO_PLATFORM ?? "facebook",
    status: "active",
    limit: "100",
  });
  const payload = await zernioRequest(`/v1/inbox/conversations?${params.toString()}`);
  const normalizedName = name.trim().toLowerCase();

  return extractZernioConversations(payload).filter((conversation) =>
    conversation.name.toLowerCase().includes(normalizedName),
  );
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
