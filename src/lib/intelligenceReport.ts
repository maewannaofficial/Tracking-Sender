import {
  buildIntelligenceOverview,
  classifyAdCampaign,
  normalizeZernioCampaigns,
  normalizeZernioPostAnalytics,
  scoreContentPost,
  type AdPerformance,
  type ContentPost,
  type IntelligenceOverview,
} from "@/lib/intelligence";

export type IntelligenceSource = "zernio" | "mock";

export type IntelligenceReport = {
  source: IntelligenceSource;
  generatedAt: string;
  overview: IntelligenceOverview;
  ads: AdPerformance[];
  content: ContentPost[];
  error?: string;
};

export function buildIntelligenceReportFromPayloads(
  campaignPayload: unknown,
  postPayload: unknown,
  source: IntelligenceSource,
  error?: string,
): IntelligenceReport {
  const ads = normalizeZernioCampaigns(campaignPayload);
  const content = normalizeZernioPostAnalytics(postPayload);

  return {
    source,
    generatedAt: new Date().toISOString(),
    overview: buildIntelligenceOverview(ads, content),
    ads,
    content,
    error,
  };
}

export function getMockIntelligenceReport(error?: string): IntelligenceReport {
  const ads = [
    classifyAdCampaign({
      id: "mock_campaign_review",
      name: "รีวิวลูกค้า + ทักแชท",
      level: "campaign",
      platform: "facebook",
      status: "active",
      spend: 1850,
      impressions: 95000,
      reach: 72000,
      clicks: 3100,
      messages: 210,
    }),
    classifyAdCampaign({
      id: "mock_campaign_traffic",
      name: "Traffic โปรส่งฟรี",
      level: "campaign",
      platform: "instagram",
      status: "active",
      spend: 2700,
      impressions: 110000,
      reach: 84000,
      clicks: 5200,
      messages: 34,
    }),
    classifyAdCampaign({
      id: "mock_campaign_broad",
      name: "Broad awareness ทะเลแห้ง",
      level: "campaign",
      platform: "facebook",
      status: "paused",
      spend: 4100,
      impressions: 160000,
      reach: 120000,
      clicks: 1800,
      messages: 18,
    }),
    classifyAdCampaign({
      id: "mock_campaign_retarget",
      name: "Retarget คนเคยทัก",
      level: "campaign",
      platform: "facebook",
      status: "active",
      spend: 920,
      impressions: 36000,
      reach: 24000,
      clicks: 860,
      messages: 62,
    }),
  ];

  const content = [
    scoreContentPost({
      id: "mock_post_unbox",
      title: "รีวิวลูกค้าแกะกล่องอาหารทะเล",
      platform: "facebook",
      publishedAt: "2026-05-20",
      reach: 22000,
      impressions: 28000,
      likes: 1320,
      comments: 270,
      shares: 210,
      clicks: 940,
      messages: 90,
      views: 28000,
      thumbnailUrl: "https://images.unsplash.com/photo-1615141982883-c7ad0e69fd62?auto=format&fit=crop&w=240&q=80",
      permalink: "https://facebook.com/",
    }),
    scoreContentPost({
      id: "mock_post_cod",
      title: "แจ้งโปร COD ส่งฟรีปลายสัปดาห์",
      platform: "instagram",
      publishedAt: "2026-05-19",
      reach: 13500,
      impressions: 16600,
      likes: 460,
      comments: 55,
      shares: 32,
      clicks: 410,
      messages: 28,
      views: 16600,
      thumbnailUrl: "https://images.unsplash.com/photo-1559737558-2f5a35f4523b?auto=format&fit=crop&w=240&q=80",
      permalink: "https://instagram.com/",
    }),
    scoreContentPost({
      id: "mock_post_hook",
      title: "คลิปสั้นโชว์แพ็กสินค้า",
      platform: "facebook",
      publishedAt: "2026-05-18",
      reach: 18000,
      impressions: 21000,
      likes: 730,
      comments: 84,
      shares: 120,
      clicks: 520,
      messages: 47,
      views: 21000,
      thumbnailUrl: "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?auto=format&fit=crop&w=240&q=80",
      permalink: "https://facebook.com/",
    }),
    scoreContentPost({
      id: "mock_post_low",
      title: "ภาพสินค้าเดี่ยวไม่มี CTA",
      platform: "instagram",
      publishedAt: "2026-05-17",
      reach: 9000,
      impressions: 10300,
      likes: 80,
      comments: 9,
      shares: 4,
      clicks: 42,
      messages: 2,
      views: 10300,
      thumbnailUrl: "https://images.unsplash.com/photo-1603073163308-9654c3fb70b5?auto=format&fit=crop&w=240&q=80",
      permalink: "https://instagram.com/",
    }),
    scoreContentPost({
      id: "mock_post_fresh",
      title: "ปลาข้างเหลืองทอดพร้อมน้ำจิ้ม",
      platform: "facebook",
      publishedAt: "2026-05-11",
      reach: 9800,
      impressions: 12400,
      likes: 57,
      comments: 6,
      shares: 20,
      clicks: 574,
      messages: 16,
      views: 9800,
      thumbnailUrl: "https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?auto=format&fit=crop&w=240&q=80",
      permalink: "https://facebook.com/",
    }),
    scoreContentPost({
      id: "mock_post_market",
      title: "หมึกผ่าเรือไดร์ 2-5 นิ้วพร้อมส่ง",
      platform: "facebook",
      publishedAt: "2026-05-01",
      reach: 40900,
      impressions: 48000,
      likes: 56,
      comments: 3,
      shares: 1,
      clicks: 64,
      messages: 9,
      views: 40900,
      thumbnailUrl: "https://images.unsplash.com/photo-1606755962773-d324e0a13086?auto=format&fit=crop&w=240&q=80",
      permalink: "https://facebook.com/",
    }),
  ];

  return {
    source: "mock",
    generatedAt: new Date().toISOString(),
    overview: buildIntelligenceOverview(ads, content),
    ads,
    content,
    error,
  };
}
