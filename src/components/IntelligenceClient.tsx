"use client";

import {
  BarChart3,
  CalendarDays,
  ExternalLink,
  Eye,
  DollarSign,
  Heart,
  Loader2,
  MessageCircle,
  MousePointer2,
  RefreshCw,
  Share2,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { sortContentPosts, type AdPerformance, type ContentPost, type PostDetailSort } from "@/lib/intelligence";
import type { IntelligenceReport } from "@/lib/intelligenceReport";

type PlatformFilter = "all" | "facebook" | "instagram";

const platformOptions: Array<{ value: PlatformFilter; label: string }> = [
  { value: "all", label: "Facebook + Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "instagram", label: "Instagram" },
];

const sortOptions: Array<{ value: PostDetailSort; label: string }> = [
  { value: "newest", label: "Newest first" },
  { value: "engagement", label: "Highest ER" },
  { value: "clicks", label: "Most clicks" },
  { value: "comments", label: "Most comments" },
];

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoDate(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

async function requestJson<T>(path: string): Promise<T> {
  const response = await fetch(path);
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(typeof payload.error === "string" ? payload.error : "โหลดข้อมูลไม่สำเร็จ");
  }

  return payload as T;
}

function baht(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "-";
  return value.toLocaleString("th-TH", { maximumFractionDigits: 2 });
}

function percent(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "-";
  return `${value.toLocaleString("th-TH", { maximumFractionDigits: 2 })}%`;
}

function compact(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "-";
  return Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function displayDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || "-";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function verdictLabel(verdict: AdPerformance["verdict"]) {
  const labels = {
    scale: "ควรเพิ่มงบ",
    fix_flow: "ปรับ flow",
    pause_or_retarget: "หยุด/เปลี่ยนกลุ่ม",
    watch: "รอดูข้อมูล",
  } satisfies Record<AdPerformance["verdict"], string>;

  return labels[verdict];
}

function getTopFixCampaign(ads: AdPerformance[]) {
  return ads.find((ad) => ad.verdict === "fix_flow" || ad.verdict === "pause_or_retarget") ?? null;
}

export function IntelligenceClient() {
  const [report, setReport] = useState<IntelligenceReport | null>(null);
  const [fromDate, setFromDate] = useState(daysAgoDate(30));
  const [toDate, setToDate] = useState(todayDate());
  const [platform, setPlatform] = useState<PlatformFilter>("all");
  const [postSort, setPostSort] = useState<PostDetailSort>("newest");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const topFixCampaign = useMemo(() => getTopFixCampaign(report?.ads ?? []), [report]);
  const topContent = useMemo(() => report?.content.slice(0, 5) ?? [], [report]);
  const postDetails = useMemo(() => sortContentPosts(report?.content ?? [], postSort), [postSort, report]);

  async function loadReport() {
    setIsLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ fromDate, toDate, platform });
      setReport(await requestJson<IntelligenceReport>(`/api/intelligence?${params.toString()}`));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let isCancelled = false;

    async function loadInitialReport() {
      try {
        const params = new URLSearchParams({ fromDate, toDate, platform });
        const nextReport = await requestJson<IntelligenceReport>(`/api/intelligence?${params.toString()}`);
        if (!isCancelled) {
          setReport(nextReport);
        }
      } catch (loadError) {
        if (!isCancelled) {
          setError(loadError instanceof Error ? loadError.message : "โหลดข้อมูลไม่สำเร็จ");
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadInitialReport();
    return () => {
      isCancelled = true;
    };
  }, [fromDate, platform, toDate]);

  return (
    <main className="min-h-screen">
      <header className="border-b border-[var(--line)] bg-[var(--panel)]">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-[var(--accent)]">Social Commerce</p>
            <h1 className="mt-1 text-2xl font-semibold">Intelligence Dashboard</h1>
          </div>
          <nav className="flex flex-wrap gap-2 text-sm">
            <Link className="rounded-md border border-[var(--line)] bg-white px-3 py-2 font-medium hover:bg-[var(--panel-muted)]" href="/dashboard">
              Tracking Sender
            </Link>
            <Link className="rounded-md bg-[var(--accent)] px-3 py-2 font-medium text-white" href="/intelligence">
              Intelligence
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-6">
        <div className="flex flex-col gap-3 border-b border-[var(--line)] pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-sm font-medium">
              <span className="mb-1 flex items-center gap-2 text-[var(--muted)]">
                <CalendarDays className="size-4" />
                จากวันที่
              </span>
              <input
                type="date"
                value={fromDate}
                onChange={(event) => setFromDate(event.target.value)}
                className="h-10 w-full rounded-md border border-[var(--line)] bg-white px-3 outline-none focus:border-[var(--accent)]"
              />
            </label>
            <label className="text-sm font-medium">
              <span className="mb-1 flex items-center gap-2 text-[var(--muted)]">
                <CalendarDays className="size-4" />
                ถึงวันที่
              </span>
              <input
                type="date"
                value={toDate}
                onChange={(event) => setToDate(event.target.value)}
                className="h-10 w-full rounded-md border border-[var(--line)] bg-white px-3 outline-none focus:border-[var(--accent)]"
              />
            </label>
            <label className="text-sm font-medium">
              <span className="mb-1 flex items-center gap-2 text-[var(--muted)]">
                <Target className="size-4" />
                Platform
              </span>
              <select
                value={platform}
                onChange={(event) => setPlatform(event.target.value as PlatformFilter)}
                className="h-10 w-full rounded-md border border-[var(--line)] bg-white px-3 outline-none focus:border-[var(--accent)]"
              >
                {platformOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button
            onClick={loadReport}
            disabled={isLoading}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[var(--accent)] px-4 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
          >
            {isLoading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            Refresh
          </button>
        </div>

        {error ? <p className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p> : null}
        {report?.error ? (
          <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            แสดงข้อมูลตัวอย่าง: {report.error}
          </p>
        ) : null}

        {isLoading && !report ? (
          <div className="py-20 text-center text-[var(--muted)]">
            <Loader2 className="mx-auto mb-3 size-6 animate-spin" />
            กำลังโหลด Social Commerce Intelligence
          </div>
        ) : report ? (
          <>
            <div className="mt-6 grid gap-3 md:grid-cols-4">
              <Metric icon={<DollarSign className="size-5" />} label="ยอดใช้เงิน" value={`${baht(report.overview.totalSpend)} บาท`} />
              <Metric icon={<MessageCircle className="size-5" />} label="คนทักจากแอด" value={report.overview.totalMessages.toLocaleString("th-TH")} />
              <Metric icon={<Target className="size-5" />} label="Cost / Message" value={`${baht(report.overview.averageCostPerMessage)} บาท`} />
              <Metric icon={<Sparkles className="size-5" />} label="โพสต์ควร Boost" value={report.overview.boostCandidates.length.toLocaleString("th-TH")} />
            </div>

            <section className="mt-6 grid gap-4 lg:grid-cols-3">
              <Insight
                title="แคมเปญดีที่สุด"
                value={report.overview.bestCampaign?.name ?? "-"}
                detail={
                  report.overview.bestCampaign
                    ? `${baht(report.overview.bestCampaign.costPerMessage)} บาทต่อคนทัก`
                    : "ยังไม่มีข้อมูลคนทัก"
                }
              />
              <Insight
                title="ควรแก้ก่อน"
                value={topFixCampaign?.name ?? "-"}
                detail={topFixCampaign?.recommendation ?? "ยังไม่พบแคมเปญเสี่ยงในช่วงนี้"}
              />
              <Insight
                title="คอนเทนต์เด่น"
                value={report.overview.bestContent?.title ?? "-"}
                detail={
                  report.overview.bestContent
                    ? `${report.overview.bestContent.grade} · Score ${report.overview.bestContent.contentScore}`
                    : "ยังไม่มีข้อมูลคอนเทนต์"
                }
              />
            </section>

            <section className="mt-8">
              <SectionHeader icon={<BarChart3 className="size-5" />} title="Ads Dashboard" />
              <div className="mt-3 overflow-x-auto rounded-lg border border-[var(--line)] bg-[var(--panel)]">
                <table className="w-full min-w-[980px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-[var(--line)] text-left text-xs uppercase text-[var(--muted)]">
                      <th className="px-3 py-3">Campaign</th>
                      <th className="px-3 py-3">Spend</th>
                      <th className="px-3 py-3">Reach</th>
                      <th className="px-3 py-3">Clicks</th>
                      <th className="px-3 py-3">CTR</th>
                      <th className="px-3 py-3">CPC</th>
                      <th className="px-3 py-3">Messages</th>
                      <th className="px-3 py-3">Cost / Msg</th>
                      <th className="px-3 py-3">สรุป</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.ads.map((ad) => (
                      <tr key={ad.id} className="border-b border-[var(--line)] last:border-0">
                        <td className="px-3 py-4">
                          <p className="font-medium">{ad.name}</p>
                          <p className="text-xs text-[var(--muted)]">{ad.platform} · {ad.status}</p>
                        </td>
                        <td className="px-3 py-4">{baht(ad.spend)}</td>
                        <td className="px-3 py-4">{ad.reach.toLocaleString("th-TH")}</td>
                        <td className="px-3 py-4">{ad.clicks.toLocaleString("th-TH")}</td>
                        <td className="px-3 py-4">{percent(ad.ctr)}</td>
                        <td className="px-3 py-4">{baht(ad.cpc)}</td>
                        <td className="px-3 py-4">{ad.messages.toLocaleString("th-TH")}</td>
                        <td className="px-3 py-4">{baht(ad.costPerMessage)}</td>
                        <td className="px-3 py-4">
                          <p className="font-medium">{verdictLabel(ad.verdict)}</p>
                          <p className="mt-1 max-w-xs text-xs leading-5 text-[var(--muted)]">{ad.recommendation}</p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="mt-8">
              <SectionHeader icon={<TrendingUp className="size-5" />} title="Content Performance" />
              <div className="mt-3 grid gap-3 lg:grid-cols-5">
                {topContent.map((post, index) => (
                  <ContentRank key={post.id} index={index + 1} post={post} />
                ))}
              </div>
              <div className="mt-4 overflow-x-auto rounded-lg border border-[var(--line)] bg-[var(--panel)]">
                <table className="w-full min-w-[920px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-[var(--line)] text-left text-xs uppercase text-[var(--muted)]">
                      <th className="px-3 py-3">Post</th>
                      <th className="px-3 py-3">Reach</th>
                      <th className="px-3 py-3">Likes</th>
                      <th className="px-3 py-3">Comments</th>
                      <th className="px-3 py-3">Shares</th>
                      <th className="px-3 py-3">Clicks</th>
                      <th className="px-3 py-3">Engagement</th>
                      <th className="px-3 py-3">Score</th>
                      <th className="px-3 py-3">คำแนะนำ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.content.map((post) => (
                      <tr key={post.id} className="border-b border-[var(--line)] last:border-0">
                        <td className="px-3 py-4">
                          <p className="font-medium">{post.title}</p>
                          <p className="text-xs text-[var(--muted)]">{post.platform} · {post.publishedAt || "-"}</p>
                        </td>
                        <td className="px-3 py-4">{post.reach.toLocaleString("th-TH")}</td>
                        <td className="px-3 py-4">{post.likes.toLocaleString("th-TH")}</td>
                        <td className="px-3 py-4">{post.comments.toLocaleString("th-TH")}</td>
                        <td className="px-3 py-4">{post.shares.toLocaleString("th-TH")}</td>
                        <td className="px-3 py-4">{post.clicks.toLocaleString("th-TH")}</td>
                        <td className="px-3 py-4">{percent(post.engagementRate)}</td>
                        <td className="px-3 py-4">
                          <span className="font-mono text-base font-semibold">{post.contentScore}</span>
                          <span className="ml-2 text-xs text-[var(--muted)]">{post.grade}</span>
                        </td>
                        <td className="px-3 py-4">{post.recommendation}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="mt-8">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Post Details</h2>
                  <p className="mt-2 font-mono text-sm text-[var(--muted)]">
                    Sorted by: {sortOptions.find((option) => option.value === postSort)?.label}
                  </p>
                </div>
                <label className="w-full text-sm font-medium sm:w-56">
                  <span className="mb-1 block text-[var(--muted)]">Sort posts</span>
                  <select
                    value={postSort}
                    onChange={(event) => setPostSort(event.target.value as PostDetailSort)}
                    className="h-10 w-full rounded-md border border-[var(--line)] bg-white px-3 outline-none focus:border-[var(--accent)]"
                  >
                    {sortOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="mt-5 grid gap-5 lg:grid-cols-3">
                {postDetails.map((post) => (
                  <PostDetailCard key={post.id} post={post} />
                ))}
              </div>
            </section>
          </>
        ) : null}
      </section>
    </main>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-4 py-3 shadow-sm">
      <div className="flex items-center gap-2 text-[var(--muted)]">
        {icon}
        <p className="text-xs font-medium uppercase">{label}</p>
      </div>
      <p className="mt-2 font-mono text-2xl font-semibold">{value}</p>
    </div>
  );
}

function Insight({ detail, title, value }: { detail: string; title: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4 shadow-sm">
      <p className="text-xs font-medium uppercase text-[var(--muted)]">{title}</p>
      <p className="mt-2 line-clamp-1 text-base font-semibold">{value}</p>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{detail}</p>
    </div>
  );
}

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2">
      {icon}
      <h2 className="text-lg font-semibold">{title}</h2>
    </div>
  );
}

function ContentRank({ index, post }: { index: number; post: ContentPost }) {
  return (
    <article className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <span className="font-mono text-sm font-semibold text-[var(--accent)]">#{index}</span>
        <span className="rounded-full bg-[var(--panel-muted)] px-2 py-1 text-xs font-medium">{post.grade}</span>
      </div>
      <h3 className="mt-3 line-clamp-2 min-h-10 text-sm font-semibold leading-5">{post.title}</h3>
      <p className="mt-3 font-mono text-2xl font-semibold">{post.contentScore}</p>
      <p className="mt-1 text-xs text-[var(--muted)]">{post.recommendation}</p>
    </article>
  );
}

function PostDetailCard({ post }: { post: ContentPost }) {
  const views = post.views && post.views > 0 ? post.views : post.impressions || post.reach;

  return (
    <article className="border border-[var(--line)] bg-[var(--panel)] p-6 shadow-sm">
      <div className="flex min-h-28 gap-5">
        <div className="h-24 w-24 shrink-0 overflow-hidden rounded-md border border-[var(--line)] bg-[var(--panel-muted)]">
          {post.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={post.thumbnailUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[var(--panel-muted)] text-xs font-medium text-[var(--muted)]">
              No image
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="line-clamp-1 text-lg font-semibold leading-7">{post.title}</h3>
              <p className="mt-1 text-sm text-[var(--muted)]">{displayDate(post.publishedAt)}</p>
            </div>
            <a
              href={post.permalink || "#"}
              target="_blank"
              rel="noreferrer"
              aria-label={`Open ${post.title}`}
              className={`inline-flex items-center gap-1 text-[var(--muted)] hover:text-[var(--accent)] ${
                post.permalink ? "" : "pointer-events-none opacity-40"
              }`}
            >
              <span className="inline-flex size-5 items-center justify-center rounded-full bg-[var(--muted)] text-xs font-bold text-white">
                f
              </span>
              <ExternalLink className="size-4" />
            </a>
          </div>
        </div>
      </div>
      <div className="my-5 h-px bg-[var(--line)]" />
      <div className="grid grid-cols-3 gap-x-3 gap-y-4 text-[var(--foreground)] sm:grid-cols-6">
        <PostMetric icon={<Heart className="size-4" />} value={compact(post.likes)} />
        <PostMetric icon={<MessageCircle className="size-4" />} value={compact(post.comments)} />
        <PostMetric icon={<Eye className="size-4" />} value={compact(views)} />
        <PostMetric icon={<TrendingUp className="size-4" />} value={compact(post.impressions)} />
        <PostMetric icon={<Share2 className="size-4" />} value={compact(post.shares)} />
        <PostMetric icon={<MousePointer2 className="size-4" />} value={compact(post.clicks)} />
      </div>
      <p className="mt-5 text-right text-sm font-semibold text-[var(--muted)]">ER {percent(post.engagementRate)}</p>
    </article>
  );
}

function PostMetric({ icon, value }: { icon: React.ReactNode; value: string }) {
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap text-sm font-semibold">
      <span className="text-[var(--muted)]">{icon}</span>
      {value}
    </span>
  );
}
