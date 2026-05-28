import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  extractZernioConversations,
  findConversationsByName,
  getZernioAdCampaigns,
  getZernioPostAnalytics,
  sendZernioInboxMessage,
} from "./zernio";

describe("extractZernioConversations", () => {
  it("normalizes Zernio conversation arrays from inbox responses", () => {
    expect(
      extractZernioConversations({
        data: [
          {
            id: "conversation_1",
            accountId: "account_1",
            participantName: "Nan Napat",
            platform: "facebook",
          },
          {
            conversationId: "conversation_2",
            accountId: "account_1",
            name: "Nann Napat",
            platform: "instagram",
          },
        ],
      }),
    ).toEqual([
      {
        conversation_id: "conversation_1",
        account_id: "account_1",
        name: "Nan Napat",
        platform: "facebook",
      },
      {
        conversation_id: "conversation_2",
        account_id: "account_1",
        name: "Nann Napat",
        platform: "instagram",
      },
    ]);
  });

  it("returns an empty array when the response contains no candidates", () => {
    expect(extractZernioConversations({ success: true })).toEqual([]);
  });
});

describe("Zernio HTTP helpers", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.ZERNIO_API_KEY = "zernio_key";
    process.env.ZERNIO_ACCOUNT_ID = "account_1";
  });

  it("sends inbox messages with accountId, messaging type, and post-purchase tag", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: {
            messageId: "message_1",
          },
        }),
        { status: 200 },
      ),
    );

    await sendZernioInboxMessage("conversation_1", "tracking message");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://zernio.com/api/v1/inbox/conversations/conversation_1/messages",
      expect.objectContaining({
        method: "POST",
        headers: {
          Authorization: "Bearer zernio_key",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          accountId: "account_1",
          message: "tracking message",
          messagingType: "MESSAGE_TAG",
          messageTag: "POST_PURCHASE_UPDATE",
        }),
      }),
    );
  });

  it("searches conversations by participant name on facebook", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            {
              id: "conversation_1",
              accountId: "account_1",
              participantName: "Nan Napat",
              platform: "facebook",
            },
            {
              id: "conversation_2",
              accountId: "account_1",
              participantName: "Other Person",
              platform: "facebook",
            },
          ],
          pagination: { hasMore: false },
        }),
        { status: 200 },
      ),
    );

    await expect(findConversationsByName("Nan")).resolves.toEqual([
      {
        conversation_id: "conversation_1",
        account_id: "account_1",
        name: "Nan Napat",
        platform: "facebook",
      },
    ]);
    expect(String(fetchMock.mock.calls[0][0])).toContain("/v1/inbox/conversations?");
    expect(String(fetchMock.mock.calls[0][0])).toContain("platform=facebook");
  });

  it("loads ad campaigns with date, platform, and account filters", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ campaigns: [] }), { status: 200 }),
    );

    await getZernioAdCampaigns({
      fromDate: "2026-05-01",
      toDate: "2026-05-20",
      platform: "facebook",
      accountId: "account_1",
    });

    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain("https://zernio.com/api/v1/ads/campaigns?");
    expect(url).toContain("platform=facebook");
    expect(url).toContain("accountId=account_1");
    expect(url).toContain("fromDate=2026-05-01");
    expect(url).toContain("toDate=2026-05-20");
  });

  it("loads post analytics sorted by engagement", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: [] }), { status: 200 }),
    );

    await getZernioPostAnalytics({
      fromDate: "2026-05-01",
      toDate: "2026-05-20",
      platform: "instagram",
      accountId: "account_1",
    });

    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain("https://zernio.com/api/v1/analytics?");
    expect(url).toContain("platform=instagram");
    expect(url).toContain("sortBy=engagement");
    expect(url).toContain("order=desc");
  });
});
