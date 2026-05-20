import type { MatchStatus, SendStatus } from "@/types/order";

type Status = MatchStatus | SendStatus;

const styles: Record<Status, string> = {
  pending: "border-slate-300 bg-slate-100 text-slate-700",
  matched: "border-emerald-200 bg-emerald-50 text-emerald-700",
  multiple_matches: "border-amber-200 bg-amber-50 text-amber-800",
  not_found: "border-rose-200 bg-rose-50 text-rose-700",
  error: "border-rose-200 bg-rose-50 text-rose-700",
  sent: "border-emerald-200 bg-emerald-50 text-emerald-700",
  failed: "border-rose-200 bg-rose-50 text-rose-700",
  skipped: "border-slate-300 bg-slate-100 text-slate-700",
};

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span
      className={`inline-flex min-h-7 items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${styles[status]}`}
    >
      {status}
    </span>
  );
}
