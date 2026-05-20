import { describe, expect, test } from "vitest";

import { buildIntelligenceQueries } from "@/lib/intelligenceQuery";

describe("buildIntelligenceQueries", () => {
  test("does not use the social account id to filter ad campaigns", () => {
    const queries = buildIntelligenceQueries(
      {
        fromDate: "2026-04-20",
        toDate: "2026-05-20",
        platform: "all",
      },
      {
        socialAccountId: "social_account",
      },
    );

    expect(queries.posts.accountId).toBe("social_account");
    expect(queries.campaigns.accountId).toBe("");
  });

  test("uses explicit Zernio ad account id for campaign filters", () => {
    const queries = buildIntelligenceQueries(
      {
        fromDate: "2026-04-20",
        toDate: "2026-05-20",
        platform: "facebook",
      },
      {
        socialAccountId: "social_account",
        adAccountId: "ad_account",
      },
    );

    expect(queries.posts).toMatchObject({ accountId: "social_account", platform: "facebook" });
    expect(queries.campaigns).toMatchObject({ accountId: "ad_account", platform: "facebook" });
  });
});
