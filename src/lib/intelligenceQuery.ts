import type { ZernioIntelligenceQuery } from "@/lib/zernio";

export type IntelligenceRequestQuery = {
  fromDate: string;
  toDate: string;
  platform: string;
};

export type IntelligenceAccountConfig = {
  socialAccountId?: string;
  adAccountId?: string;
};

export function buildIntelligenceQueries(
  request: IntelligenceRequestQuery,
  config: IntelligenceAccountConfig,
): { campaigns: ZernioIntelligenceQuery; posts: ZernioIntelligenceQuery } {
  const base = {
    fromDate: request.fromDate,
    toDate: request.toDate,
    platform: request.platform,
  };

  return {
    campaigns: {
      ...base,
      accountId: config.adAccountId ?? "",
    },
    posts: {
      ...base,
      accountId: config.socialAccountId ?? "",
    },
  };
}
