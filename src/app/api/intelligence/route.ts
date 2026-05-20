import { NextResponse, type NextRequest } from "next/server";

import { isRequestAuthenticated } from "@/lib/auth";
import { buildIntelligenceQueries } from "@/lib/intelligenceQuery";
import { buildIntelligenceReportFromPayloads, getMockIntelligenceReport } from "@/lib/intelligenceReport";
import { getZernioAdCampaigns, getZernioPostAnalytics } from "@/lib/zernio";

function getDefaultDateRange() {
  const to = new Date();
  const from = new Date(to);
  from.setDate(to.getDate() - 30);

  return {
    fromDate: from.toISOString().slice(0, 10),
    toDate: to.toISOString().slice(0, 10),
  };
}

export async function GET(request: NextRequest) {
  if (!isRequestAuthenticated(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const defaults = getDefaultDateRange();
  const query = {
    fromDate: request.nextUrl.searchParams.get("fromDate") ?? defaults.fromDate,
    toDate: request.nextUrl.searchParams.get("toDate") ?? defaults.toDate,
    platform: request.nextUrl.searchParams.get("platform") ?? "all",
  };
  const queries = buildIntelligenceQueries(query, {
    socialAccountId: request.nextUrl.searchParams.get("accountId") ?? process.env.ZERNIO_ACCOUNT_ID ?? "",
    adAccountId: request.nextUrl.searchParams.get("adAccountId") ?? process.env.ZERNIO_AD_ACCOUNT_ID ?? "",
  });

  if (!process.env.ZERNIO_API_KEY) {
    return NextResponse.json(getMockIntelligenceReport("ยังไม่ได้ตั้งค่า ZERNIO_API_KEY จึงแสดงข้อมูลตัวอย่าง"));
  }

  try {
    const [campaigns, posts] = await Promise.all([
      getZernioAdCampaigns(queries.campaigns),
      getZernioPostAnalytics(queries.posts),
    ]);

    const report = buildIntelligenceReportFromPayloads(campaigns, posts, "zernio");
    if (report.ads.length === 0 && report.content.length === 0) {
      return NextResponse.json(getMockIntelligenceReport("Zernio ยังไม่ส่งข้อมูล Ads/Content สำหรับช่วงวันที่นี้"));
    }

    return NextResponse.json(report);
  } catch (error) {
    return NextResponse.json(
      getMockIntelligenceReport(error instanceof Error ? error.message : "โหลดข้อมูล Zernio ไม่สำเร็จ"),
    );
  }
}
