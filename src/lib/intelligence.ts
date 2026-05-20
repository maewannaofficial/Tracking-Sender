export type AdLevel = "campaign" | "ad_set" | "ad";
export type AdVerdict = "scale" | "fix_flow" | "pause_or_retarget" | "watch";
export type ContentGrade = "ดี" | "ปานกลาง" | "แย่";
export type PostDetailSort = "newest" | "engagement" | "clicks" | "comments";

export type AdPerformanceInput = {
  id: string;
  name: string;
  level: AdLevel;
  platform: string;
  status: string;
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  messages: number;
  ctr?: number;
  cpc?: number;
  cpm?: number;
};

export type AdPerformance = AdPerformanceInput & {
  ctr: number;
  cpc: number;
  cpm: number;
  costPerMessage: number | null;
  verdict: AdVerdict;
  recommendation: string;
};

export type ContentPostInput = {
  id: string;
  title: string;
  platform: string;
  publishedAt: string;
  reach: number;
  impressions: number;
  likes: number;
  comments: number;
  shares: number;
  clicks: number;
  messages?: number;
  views?: number;
  thumbnailUrl?: string;
  permalink?: string;
  engagementRate?: number;
};

export type ContentPost = ContentPostInput & {
  engagementRate: number;
  contentScore: number;
  grade: ContentGrade;
  recommendation: string;
};

export type IntelligenceOverview = {
  totalSpend: number;
  totalMessages: number;
  averageCostPerMessage: number | null;
  bestCampaign: AdPerformance | null;
  bestContent: ContentPost | null;
  boostCandidates: ContentPost[];
};

function numberValue(value: unknown) {
  const number = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function stringValue(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function round(value: number, digits = 2) {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}

function safeRate(numerator: number, denominator: number, multiplier = 1) {
  if (denominator <= 0) return 0;
  return round((numerator / denominator) * multiplier);
}

export function classifyAdCampaign(input: AdPerformanceInput): AdPerformance {
  const ctr = input.ctr ?? safeRate(input.clicks, input.impressions, 100);
  const cpc = input.cpc ?? safeRate(input.spend, input.clicks);
  const cpm = input.cpm ?? safeRate(input.spend, input.impressions, 1000);
  const costPerMessage = input.messages > 0 ? round(input.spend / input.messages) : null;

  let verdict: AdVerdict = "watch";
  let recommendation = "เก็บข้อมูลต่ออีกเล็กน้อยก่อนตัดสินใจ";

  if (costPerMessage !== null && costPerMessage <= 20 && input.messages >= 10) {
    verdict = "scale";
    recommendation = "ต้นทุนต่อคนทักต่ำ ควรเพิ่มงบแบบค่อยเป็นค่อยไป";
  } else if (ctr >= 2.5 && input.messages < Math.max(10, input.clicks * 0.01)) {
    verdict = "fix_flow";
    recommendation = "CTR ดี แต่คนทักน้อย ควรปรับข้อความ ปุ่ม หรือ flow หลังคลิก";
  } else if (input.spend >= 1000 && (costPerMessage === null || costPerMessage > 80)) {
    verdict = "pause_or_retarget";
    recommendation = "ใช้เงินสูงแต่คนทักน้อย ควรหยุดชั่วคราวหรือปรับกลุ่มเป้าหมาย";
  }

  return {
    ...input,
    ctr: round(ctr),
    cpc: round(cpc),
    cpm: round(cpm),
    costPerMessage,
    verdict,
    recommendation,
  };
}

export function scoreContentPost(input: ContentPostInput): ContentPost {
  const interactions = input.likes + input.comments + input.shares + input.clicks + (input.messages ?? 0);
  const providedEngagementRate = "engagementRate" in input ? numberValue((input as { engagementRate?: unknown }).engagementRate) : 0;
  const engagementRate = providedEngagementRate || safeRate(interactions, input.reach || input.impressions, 100);
  const score = Math.min(100, Math.round(engagementRate * 8 + input.shares * 0.08 + input.comments * 0.06));

  let grade: ContentGrade = "แย่";
  let recommendation = "Improve creative hook";

  if (score >= 75) {
    grade = "ดี";
    recommendation = "Boost this post";
  } else if (score >= 45) {
    grade = "ปานกลาง";
    recommendation = "Add stronger call-to-action";
  } else if (input.comments > input.shares * 2) {
    recommendation = "Create more customer review content";
  }

  return {
    ...input,
    engagementRate,
    contentScore: score,
    grade,
    recommendation,
  };
}

export function buildIntelligenceOverview(
  ads: AdPerformance[],
  posts: ContentPost[],
): IntelligenceOverview {
  const totalSpend = round(ads.reduce((sum, ad) => sum + ad.spend, 0));
  const totalMessages = ads.reduce((sum, ad) => sum + ad.messages, 0);
  const averageCostPerMessage = totalMessages > 0 ? round(totalSpend / totalMessages) : null;
  const bestCampaign = [...ads]
    .filter((ad) => ad.costPerMessage !== null)
    .sort((a, b) => (a.costPerMessage ?? Infinity) - (b.costPerMessage ?? Infinity))[0] ?? null;
  const bestContent = [...posts].sort((a, b) => b.contentScore - a.contentScore)[0] ?? null;

  return {
    totalSpend,
    totalMessages,
    averageCostPerMessage,
    bestCampaign,
    bestContent,
    boostCandidates: posts.filter((post) => post.grade === "ดี").sort((a, b) => b.contentScore - a.contentScore),
  };
}

export function sortContentPosts(posts: ContentPost[], sort: PostDetailSort) {
  const sorted = [...posts];

  if (sort === "newest") {
    return sorted.sort((a, b) => Date.parse(b.publishedAt || "0") - Date.parse(a.publishedAt || "0"));
  }
  if (sort === "engagement") {
    return sorted.sort((a, b) => b.engagementRate - a.engagementRate);
  }
  if (sort === "clicks") {
    return sorted.sort((a, b) => b.clicks - a.clicks);
  }

  return sorted.sort((a, b) => b.comments - a.comments);
}

function getMessageCount(actions: unknown) {
  if (!actions || typeof actions !== "object") return 0;

  return Object.entries(actions as Record<string, unknown>).reduce((sum, [key, value]) => {
    const normalized = key.toLowerCase();
    if (normalized.includes("message") || normalized.includes("conversation") || normalized.includes("onsite_conversion.messaging")) {
      return sum + numberValue(value);
    }
    return sum;
  }, 0);
}

export function normalizeZernioCampaigns(payload: unknown): AdPerformance[] {
  const container = payload as Record<string, unknown>;
  const rows =
    (Array.isArray(container.campaigns) && container.campaigns) ||
    (Array.isArray(container.data) && container.data) ||
    [];

  return rows.flatMap((row) => {
    if (!row || typeof row !== "object") return [];

    const item = row as Record<string, unknown>;
    const metrics = (item.metrics && typeof item.metrics === "object" ? item.metrics : {}) as Record<string, unknown>;
    const id = item.platformCampaignId ?? item.id ?? item.campaignId;
    const name = item.campaignName ?? item.name ?? item.platformCampaignName;
    if (id === undefined || name === undefined) return [];

    return [
      classifyAdCampaign({
        id: String(id),
        name: String(name),
        level: "campaign",
        platform: typeof item.platform === "string" ? item.platform : "meta",
        status: typeof item.status === "string" ? item.status : "",
        spend: numberValue(metrics.spend),
        impressions: numberValue(metrics.impressions),
        reach: numberValue(metrics.reach),
        clicks: numberValue(metrics.clicks),
        messages: getMessageCount(metrics.actions),
        ctr: metrics.ctr === undefined ? undefined : numberValue(metrics.ctr),
        cpc: metrics.cpc === undefined ? undefined : numberValue(metrics.cpc),
        cpm: metrics.cpm === undefined ? undefined : numberValue(metrics.cpm),
      }),
    ];
  });
}

export function normalizeZernioPostAnalytics(payload: unknown): ContentPost[] {
  const container = payload as Record<string, unknown>;
  const rows =
    (Array.isArray(container.data) && container.data) ||
    (Array.isArray(container.posts) && container.posts) ||
    (Array.isArray(container.analytics) && container.analytics) ||
    [];

  return rows.flatMap((row) => {
    if (!row || typeof row !== "object") return [];

    const item = row as Record<string, unknown>;
    const metrics = (
      item.metrics && typeof item.metrics === "object"
        ? item.metrics
        : item.analytics && typeof item.analytics === "object"
          ? item.analytics
          : item
    ) as Record<string, unknown>;
    const platforms = Array.isArray(item.platforms) ? item.platforms : [];
    const firstPlatform = platforms.find((platformItem) => platformItem && typeof platformItem === "object") as
      | Record<string, unknown>
      | undefined;
    const id = item.postId ?? item.id ?? item._id ?? item.platformPostId ?? firstPlatform?.platformPostId;
    if (id === undefined) return [];

    const title = item.text ?? item.title ?? item.caption ?? item.content ?? item.message ?? `Post ${id}`;
    return [
      scoreContentPost({
        id: String(id),
        title: String(title).slice(0, 90),
        platform:
          typeof item.platform === "string"
            ? item.platform
            : typeof firstPlatform?.platform === "string"
              ? firstPlatform.platform
              : "meta",
        publishedAt: String(item.date ?? item.publishedAt ?? item.createdAt ?? ""),
        reach: numberValue(metrics.reach),
        impressions: numberValue(metrics.impressions),
        likes: numberValue(metrics.likes),
        comments: numberValue(metrics.comments),
        shares: numberValue(metrics.shares),
        clicks: numberValue(metrics.clicks),
        messages: getMessageCount(metrics.actions),
        views: numberValue(metrics.views ?? metrics.videoViews ?? metrics.video_views ?? metrics.plays),
        thumbnailUrl: stringValue(
          item.thumbnailUrl,
          item.thumbnail_url,
          item.mediaUrl,
          item.media_url,
          item.imageUrl,
          item.image_url,
          firstPlatform?.thumbnailUrl,
          metrics.thumbnailUrl,
          metrics.mediaUrl,
          metrics.imageUrl,
        ),
        permalink: stringValue(
          item.permalink,
          item.permalinkUrl,
          item.permalink_url,
          item.platformPostUrl,
          item.postUrl,
          item.post_url,
          firstPlatform?.platformPostUrl,
          metrics.permalink,
          metrics.permalinkUrl,
        ),
        engagementRate: numberValue(metrics.engagementRate),
      }),
    ];
  });
}
