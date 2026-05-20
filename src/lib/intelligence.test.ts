import { describe, expect, test } from "vitest";

import {
  buildIntelligenceOverview,
  classifyAdCampaign,
  normalizeZernioCampaigns,
  normalizeZernioPostAnalytics,
  scoreContentPost,
  sortContentPosts,
} from "@/lib/intelligence";

describe("social commerce intelligence", () => {
  test("classifies campaigns with cheap messages as scale candidates", () => {
    const campaign = classifyAdCampaign({
      id: "cmp_1",
      name: "Review winners",
      level: "campaign",
      platform: "facebook",
      status: "active",
      spend: 1200,
      impressions: 80000,
      reach: 56000,
      clicks: 2400,
      messages: 160,
      ctr: 3,
      cpc: 0.5,
      cpm: 15,
    });

    expect(campaign.costPerMessage).toBe(7.5);
    expect(campaign.verdict).toBe("scale");
    expect(campaign.recommendation).toContain("เพิ่มงบ");
  });

  test("classifies high click campaigns with weak chats as flow problems", () => {
    const campaign = classifyAdCampaign({
      id: "cmp_2",
      name: "Traffic but no inbox",
      level: "campaign",
      platform: "instagram",
      status: "active",
      spend: 3000,
      impressions: 100000,
      reach: 70000,
      clicks: 5000,
      messages: 12,
      ctr: 5,
      cpc: 0.6,
      cpm: 30,
    });

    expect(campaign.verdict).toBe("fix_flow");
    expect(campaign.recommendation).toContain("CTR ดี");
  });

  test("scores posts and recommends boosting strong content", () => {
    const post = scoreContentPost({
      id: "post_1",
      title: "รีวิวลูกค้าแกะกล่อง",
      platform: "facebook",
      publishedAt: "2026-05-19",
      reach: 20000,
      impressions: 25000,
      likes: 1100,
      comments: 260,
      shares: 180,
      clicks: 900,
      messages: 80,
    });

    expect(post.engagementRate).toBeCloseTo(12.6, 2);
    expect(post.contentScore).toBeGreaterThanOrEqual(85);
    expect(post.grade).toBe("ดี");
    expect(post.recommendation).toBe("Boost this post");
  });

  test("builds overview from ads and posts", () => {
    const overview = buildIntelligenceOverview(
      [
        classifyAdCampaign({
          id: "cmp_1",
          name: "Winner",
          level: "campaign",
          platform: "facebook",
          status: "active",
          spend: 100,
          impressions: 10000,
          reach: 8000,
          clicks: 300,
          messages: 20,
          ctr: 3,
          cpc: 0.33,
          cpm: 10,
        }),
      ],
      [
        scoreContentPost({
          id: "post_1",
          title: "Best post",
          platform: "instagram",
          publishedAt: "2026-05-20",
          reach: 10000,
          impressions: 12000,
          likes: 500,
          comments: 120,
          shares: 80,
          clicks: 300,
          messages: 30,
        }),
      ],
    );

    expect(overview.totalSpend).toBe(100);
    expect(overview.totalMessages).toBe(20);
    expect(overview.bestCampaign?.name).toBe("Winner");
    expect(overview.bestContent?.title).toBe("Best post");
  });

  test("normalizes Zernio campaign and analytics payload shapes", () => {
    const campaigns = normalizeZernioCampaigns({
      campaigns: [
        {
          platformCampaignId: "123",
          campaignName: "Meta campaign",
          platform: "facebook",
          status: "active",
          metrics: {
            spend: 250,
            impressions: 10000,
            reach: 8000,
            clicks: 400,
            ctr: 4,
            cpc: 0.625,
            cpm: 25,
            actions: { messaging_conversation_started_7d: 25 },
          },
        },
      ],
    });
    const posts = normalizeZernioPostAnalytics({
      data: [
        {
          postId: "p1",
          text: "Hook post",
          platform: "instagram",
          date: "2026-05-18",
          metrics: {
            reach: 9000,
            impressions: 10000,
            likes: 200,
            comments: 30,
            shares: 20,
            clicks: 120,
          },
        },
      ],
    });

    expect(campaigns[0]).toMatchObject({ id: "123", messages: 25, costPerMessage: 10 });
    expect(posts[0]).toMatchObject({ id: "p1", title: "Hook post" });
  });

  test("normalizes post detail fields for visual cards", () => {
    const posts = normalizeZernioPostAnalytics({
      data: [
        {
          postId: "p1",
          caption: "สินค้าใหม่พร้อมส่ง",
          platform: "facebook",
          publishedAt: "2026-05-18T10:30:00.000Z",
          mediaUrl: "https://example.com/post.jpg",
          permalinkUrl: "https://facebook.com/post/1",
          metrics: {
            reach: 9000,
            impressions: 10000,
            videoViews: 4200,
            likes: 200,
            comments: 30,
            shares: 20,
            clicks: 120,
          },
        },
      ],
    });

    expect(posts[0]).toMatchObject({
      id: "p1",
      title: "สินค้าใหม่พร้อมส่ง",
      thumbnailUrl: "https://example.com/post.jpg",
      permalink: "https://facebook.com/post/1",
      views: 4200,
    });
  });

  test("normalizes current Zernio analytics list posts shape", () => {
    const posts = normalizeZernioPostAnalytics({
      posts: [
        {
          _id: "zernio_post_1",
          content: "ปลาข้างเหลือง หรือ ปลากิ...",
          publishedAt: "2026-05-19T03:30:00.000Z",
          analytics: {
            impressions: 876,
            reach: 876,
            likes: 11,
            comments: 2,
            shares: 10,
            clicks: 8,
            views: 876,
            engagementRate: 2.63,
          },
          platforms: [
            {
              platform: "facebook",
              platformPostUrl: "https://facebook.com/post/real",
              analytics: {
                impressions: 876,
              },
            },
          ],
          platform: "facebook",
          platformPostUrl: "https://facebook.com/post/real",
          thumbnailUrl: "https://example.com/thumb.jpg",
        },
      ],
    });

    expect(posts[0]).toMatchObject({
      id: "zernio_post_1",
      title: "ปลาข้างเหลือง หรือ ปลากิ...",
      platform: "facebook",
      reach: 876,
      impressions: 876,
      likes: 11,
      comments: 2,
      shares: 10,
      clicks: 8,
      views: 876,
      engagementRate: 2.63,
      thumbnailUrl: "https://example.com/thumb.jpg",
      permalink: "https://facebook.com/post/real",
    });
  });

  test("sorts post details by newest, engagement, clicks, and comments", () => {
    const posts = [
      scoreContentPost({
        id: "old_high_er",
        title: "High ER",
        platform: "facebook",
        publishedAt: "2026-05-01",
        reach: 1000,
        impressions: 1200,
        likes: 120,
        comments: 10,
        shares: 8,
        clicks: 20,
      }),
      scoreContentPost({
        id: "new_low_er",
        title: "Newest",
        platform: "facebook",
        publishedAt: "2026-05-20",
        reach: 10000,
        impressions: 12000,
        likes: 50,
        comments: 40,
        shares: 3,
        clicks: 300,
      }),
    ];

    expect(sortContentPosts(posts, "newest")[0].id).toBe("new_low_er");
    expect(sortContentPosts(posts, "engagement")[0].id).toBe("old_high_er");
    expect(sortContentPosts(posts, "clicks")[0].id).toBe("new_low_er");
    expect(sortContentPosts(posts, "comments")[0].id).toBe("new_low_er");
  });
});
