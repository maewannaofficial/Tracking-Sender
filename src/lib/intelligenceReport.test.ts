import { describe, expect, test } from "vitest";

import { buildIntelligenceReportFromPayloads, getMockIntelligenceReport } from "@/lib/intelligenceReport";

describe("intelligence report", () => {
  test("builds a report from raw Zernio payloads", () => {
    const report = buildIntelligenceReportFromPayloads(
      {
        campaigns: [
          {
            platformCampaignId: "campaign_1",
            campaignName: "Flash sale message",
            platform: "facebook",
            status: "active",
            metrics: {
              spend: 500,
              impressions: 20000,
              reach: 15000,
              clicks: 600,
              actions: { messaging_conversation_started_7d: 50 },
            },
          },
        ],
      },
      {
        data: [
          {
            postId: "post_1",
            text: "รีวิวจากลูกค้า",
            platform: "facebook",
            date: "2026-05-20",
            metrics: {
              reach: 10000,
              impressions: 12000,
              likes: 700,
              comments: 90,
              shares: 50,
              clicks: 200,
            },
          },
        ],
      },
      "zernio",
    );

    expect(report.source).toBe("zernio");
    expect(report.ads).toHaveLength(1);
    expect(report.content).toHaveLength(1);
    expect(report.overview.totalSpend).toBe(500);
  });

  test("returns realistic mock data for empty setup", () => {
    const report = getMockIntelligenceReport();

    expect(report.source).toBe("mock");
    expect(report.ads.length).toBeGreaterThan(2);
    expect(report.content.length).toBeGreaterThan(2);
    expect(report.overview.bestCampaign).not.toBeNull();
    expect(report.overview.boostCandidates.length).toBeGreaterThan(0);
  });
});
