"use client";

import {
  CheckCircle2,
  Loader2,
  LogOut,
  RefreshCw,
  Search,
  Send,
  UserCheck,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  getAutoMatchTargets,
  getBatchReadyOrders,
  getConversationId,
  getConversationStatus,
  type ConversationOverrideMap,
} from "@/components/dashboardBulkActions";
import { formatConversationDisplay } from "@/components/conversationDisplay";
import type { OrderStatusFilter, TrackingOrder, ZernioConversationCandidate } from "@/types/order";

type Toast = { type: "success" | "error"; message: string };
type MatchState = {
  order: TrackingOrder;
  candidates: ZernioConversationCandidate[];
  manualValue: string;
};

const filters: Array<{ value: OrderStatusFilter; label: string }> = [
  { value: "all", label: "ทั้งหมด" },
  { value: "pending", label: "รอส่ง" },
  { value: "failed", label: "ส่งไม่สำเร็จ" },
  { value: "sent", label: "ส่งแล้ว" },
  { value: "not_found", label: "ไม่พบลูกค้า" },
];

function sendDisabledReason(order: TrackingOrder) {
  if (order.send_status === "sent") return "ส่งแล้ว";
  if (!order.subscriber_id) return "ไม่มี conversationId";
  if (!order.message) return "ไม่มีข้อความ";
  return "";
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(typeof payload.error === "string" ? payload.error : "Request failed");
  }

  return payload as T;
}

export function DashboardClient() {
  const [orders, setOrders] = useState<TrackingOrder[]>([]);
  const [filter, setFilter] = useState<OrderStatusFilter>("pending");
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [busyKey, setBusyKey] = useState("");
  const [toast, setToast] = useState<Toast | null>(null);
  const [previewOrder, setPreviewOrder] = useState<TrackingOrder | null>(null);
  const [confirmOrder, setConfirmOrder] = useState<TrackingOrder | null>(null);
  const [matchState, setMatchState] = useState<MatchState | null>(null);
  const [conversationOverrides, setConversationOverrides] = useState<ConversationOverrideMap>({});
  const [selectedRows, setSelectedRows] = useState<Record<number, boolean>>({});
  const [isAutoMatching, setIsAutoMatching] = useState(false);
  const [isBatchConfirmOpen, setIsBatchConfirmOpen] = useState(false);
  const autoMatchAttemptedRows = useRef<Set<number>>(new Set());

  const visibleOrders = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return orders;

    return orders.filter((order) =>
      [order.id, order.fb_name, order.customer_name, order.tracking_no, order.subscriber_id, order.message]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [orders, query]);

  const stats = useMemo(
    () => ({
      total: orders.length,
      ready: orders.filter((order) =>
        !sendDisabledReason({
          ...order,
          subscriber_id: conversationOverrides[order.rowNumber]?.conversationId || order.subscriber_id,
        }),
      ).length,
      failed: orders.filter((order) => order.send_status === "failed").length,
      sent: orders.filter((order) => order.send_status === "sent").length,
    }),
    [orders, conversationOverrides],
  );

  const selectedRowNumbers = useMemo(
    () =>
      new Set(
        Object.entries(selectedRows)
          .filter(([, selected]) => selected)
          .map(([rowNumber]) => Number(rowNumber)),
      ),
    [selectedRows],
  );

  const selectedOrders = useMemo(
    () => visibleOrders.filter((order) => selectedRowNumbers.has(order.rowNumber)),
    [selectedRowNumbers, visibleOrders],
  );

  const batchReadyOrders = useMemo(
    () => getBatchReadyOrders(orders, selectedRowNumbers, conversationOverrides),
    [conversationOverrides, orders, selectedRowNumbers],
  );

  const allVisibleSelected =
    visibleOrders.length > 0 && visibleOrders.every((order) => selectedRows[order.rowNumber]);

  async function matchConversation(
    order: TrackingOrder,
    options: { silent?: boolean; reload?: boolean; openCandidates?: boolean } = {},
  ) {
    const { openCandidates = true, reload = true, silent = false } = options;
    setBusyKey(`match:${order.rowNumber}`);
    try {
      const payload = await requestJson<
        | { status: "matched"; subscriber_id: string; subscriber: ZernioConversationCandidate }
        | { status: "multiple_matches"; candidates: ZernioConversationCandidate[] }
        | { status: "not_found" }
        | { status: "error"; error: string }
      >("/api/match-subscriber", {
        method: "POST",
        body: JSON.stringify({ rowNumber: order.rowNumber, fb_name: order.fb_name }),
      });

      if (payload.status === "multiple_matches") {
        if (openCandidates) {
          setMatchState({ order, candidates: payload.candidates, manualValue: "" });
        }
      } else if (payload.status === "not_found") {
        if (openCandidates) {
          setMatchState({ order, candidates: [], manualValue: "" });
        }
      } else if (payload.status === "matched") {
        setConversationOverrides((current) => ({
          ...current,
          [order.rowNumber]: {
            conversationId: payload.subscriber_id,
            name: payload.subscriber.name,
            platform: payload.subscriber.platform,
          },
        }));
        if (!silent) {
          setToast({ type: "success", message: `เลือก conversation ของ ${payload.subscriber.name} แล้ว` });
        }
        return true;
      } else {
        if (!silent) {
          setToast({ type: "error", message: payload.error });
        }
      }
      if (reload) {
        await loadOrders();
      }
      return false;
    } catch (error) {
      if (!silent) {
        setToast({ type: "error", message: error instanceof Error ? error.message : "จับคู่ไม่สำเร็จ" });
      }
      return false;
    } finally {
      setBusyKey("");
    }
  }

  async function autoMatchOrders(nextOrders: TrackingOrder[]) {
    const targets = getAutoMatchTargets(nextOrders, conversationOverrides, autoMatchAttemptedRows.current);
    if (targets.length === 0) {
      return;
    }

    setIsAutoMatching(true);
    let matchedCount = 0;

    try {
      for (const order of targets) {
        autoMatchAttemptedRows.current.add(order.rowNumber);
        const matched = await matchConversation(order, { silent: true, reload: false, openCandidates: false });
        if (matched) {
          matchedCount += 1;
        }
      }
      if (matchedCount > 0) {
        setToast({ type: "success", message: `Auto match conversation สำเร็จ ${matchedCount} รายการ` });
      }
    } finally {
      setIsAutoMatching(false);
    }
  }

  async function checkMatch(order: TrackingOrder) {
    await matchConversation(order);
  }

  async function loadOrders(nextFilter = filter) {
    setIsLoading(true);
    try {
      const payload = await requestJson<{ orders: TrackingOrder[] }>(`/api/orders?status=${nextFilter}`);
      setOrders(payload.orders);
      void autoMatchOrders(payload.orders);
    } catch (error) {
      setToast({ type: "error", message: error instanceof Error ? error.message : "โหลดข้อมูลไม่สำเร็จ" });
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    // The dashboard intentionally refreshes from Google Sheets whenever the filter changes.
    loadOrders(filter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  async function selectConversation(conversationId: string) {
    if (!matchState) return;

    setBusyKey(`select:${matchState.order.rowNumber}`);
    try {
      await requestJson("/api/select-subscriber", {
        method: "POST",
        body: JSON.stringify({ rowNumber: matchState.order.rowNumber, subscriber_id: conversationId }),
      });
      setConversationOverrides((current) => ({
        ...current,
        [matchState.order.rowNumber]: {
          conversationId,
          name: matchState.candidates.find((candidate) => candidate.conversation_id === conversationId)?.name,
          platform: matchState.candidates.find((candidate) => candidate.conversation_id === conversationId)?.platform,
        },
      }));
      setToast({ type: "success", message: "เลือก conversation แล้ว" });
      setMatchState(null);
      await loadOrders();
    } catch (error) {
      setToast({ type: "error", message: error instanceof Error ? error.message : "บันทึกไม่สำเร็จ" });
    } finally {
      setBusyKey("");
    }
  }

  async function sendMessage(order: TrackingOrder) {
    setBusyKey(`send:${order.rowNumber}`);
    try {
      const payload = await requestJson<{ status: "sent"; sent_at: string } | { status: "failed"; error: string }>(
        "/api/send-message",
        {
          method: "POST",
          body: JSON.stringify({
            rowNumber: order.rowNumber,
            subscriber_id: conversationOverrides[order.rowNumber]?.conversationId || order.subscriber_id,
          }),
        },
      );

      if (payload.status === "sent") {
        setToast({ type: "success", message: "ส่งข้อความและอัปเดต Sheet แล้ว" });
      } else {
        setToast({ type: "error", message: payload.error });
      }
      setConfirmOrder(null);
      await loadOrders();
    } catch (error) {
      setToast({ type: "error", message: error instanceof Error ? error.message : "ส่งข้อความไม่สำเร็จ" });
    } finally {
      setBusyKey("");
    }
  }

  async function sendSelectedMessages() {
    setBusyKey("batch-send");
    let sentCount = 0;
    let failedCount = 0;

    try {
      for (const order of batchReadyOrders) {
        const payload = await requestJson<{ status: "sent"; sent_at: string } | { status: "failed"; error: string }>(
          "/api/send-message",
          {
            method: "POST",
            body: JSON.stringify({
              rowNumber: order.rowNumber,
              subscriber_id: getConversationId(order, conversationOverrides),
            }),
          },
        );

        if (payload.status === "sent") {
          sentCount += 1;
        } else {
          failedCount += 1;
        }
      }

      setToast({
        type: failedCount > 0 ? "error" : "success",
        message:
          failedCount > 0
            ? `ส่งสำเร็จ ${sentCount} รายการ, ไม่สำเร็จ ${failedCount} รายการ`
            : `ส่งสำเร็จ ${sentCount} รายการ`,
      });
      setSelectedRows({});
      setIsBatchConfirmOpen(false);
      await loadOrders();
    } catch (error) {
      setToast({ type: "error", message: error instanceof Error ? error.message : "ส่งหลายรายการไม่สำเร็จ" });
    } finally {
      setBusyKey("");
    }
  }

  function toggleRow(rowNumber: number) {
    setSelectedRows((current) => ({
      ...current,
      [rowNumber]: !current[rowNumber],
    }));
  }

  function toggleAllVisible() {
    setSelectedRows((current) => {
      const next = { ...current };
      for (const order of visibleOrders) {
        next[order.rowNumber] = !allVisibleSelected;
      }
      return next;
    });
  }

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <main className="min-h-screen">
      <header className="border-b border-[var(--line)] bg-[var(--panel)]">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-[var(--accent)]">บ้านรวมทะเล</p>
            <h1 className="mt-1 text-2xl font-semibold">Tracking Sender Dashboard</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard"
              className="inline-flex h-10 items-center justify-center rounded-md bg-[var(--accent)] px-3 text-sm font-medium text-white"
            >
              Tracking
            </Link>
            <Link
              href="/intelligence"
              className="inline-flex h-10 items-center justify-center rounded-md border border-[var(--line)] bg-white px-3 text-sm font-medium hover:bg-[var(--panel-muted)]"
            >
              Intelligence
            </Link>
            <button
              onClick={logout}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[var(--line)] bg-white px-3 text-sm font-medium hover:bg-[var(--panel-muted)]"
            >
              <LogOut className="size-4" />
              ออกจากระบบ
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-6">
        <div className="grid gap-3 sm:grid-cols-4">
          <Metric label="รายการ" value={stats.total} />
          <Metric label="พร้อมส่ง" value={stats.ready} />
          <Metric label="ส่งไม่สำเร็จ" value={stats.failed} />
          <Metric label="ส่งแล้ว" value={stats.sent} />
        </div>

        <div className="mt-5 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <select
                value={filter}
                onChange={(event) => setFilter(event.target.value as OrderStatusFilter)}
                className="h-10 rounded-md border border-[var(--line)] bg-white px-3 text-sm outline-none focus:border-[var(--accent)]"
              >
                {filters.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--muted)]" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="ค้นหา"
                  className="h-10 w-full rounded-md border border-[var(--line)] bg-white pl-9 pr-3 text-sm outline-none focus:border-[var(--accent)] sm:w-72"
                />
              </label>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <ActionButton
                onClick={() => setIsBatchConfirmOpen(true)}
                disabled={batchReadyOrders.length === 0 || busyKey === "batch-send"}
                icon={<Send className="size-4" />}
              >
                Confirm Selected ({batchReadyOrders.length})
              </ActionButton>
              <ActionButton onClick={() => loadOrders()} disabled={isLoading} icon={<RefreshCw className="size-4" />}>
                Refresh Sheet
              </ActionButton>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
            <span>เลือกแล้ว {selectedOrders.length} รายการ</span>
            <span>พร้อมส่ง {batchReadyOrders.length} รายการ</span>
            {isAutoMatching ? (
              <span className="inline-flex items-center gap-1 text-[var(--accent)]">
                <Loader2 className="size-3 animate-spin" />
                กำลัง auto match conversation
              </span>
            ) : null}
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[940px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--line)] text-left text-xs uppercase text-[var(--muted)]">
                  <th className="px-3 py-3 font-semibold">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleAllVisible}
                      aria-label="เลือกทุกรายการที่เห็น"
                      className="size-4"
                    />
                  </th>
                  <th className="px-3 py-3 font-semibold">ID</th>
                  <th className="px-3 py-3 font-semibold">FB Name</th>
                  <th className="px-3 py-3 font-semibold">COD</th>
                  <th className="px-3 py-3 font-semibold">Message</th>
                  <th className="px-3 py-3 font-semibold">Conversation</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-3 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td className="px-3 py-8 text-center text-[var(--muted)]" colSpan={8}>
                      <Loader2 className="mx-auto mb-2 size-5 animate-spin" />
                      กำลังโหลดข้อมูล
                    </td>
                  </tr>
                ) : visibleOrders.length === 0 ? (
                  <tr>
                    <td className="px-3 py-8 text-center text-[var(--muted)]" colSpan={8}>
                      ไม่มีรายการในตัวกรองนี้
                    </td>
                  </tr>
                ) : (
                  visibleOrders.map((order) => {
                    const effectiveOrder = {
                      ...order,
                      subscriber_id: conversationOverrides[order.rowNumber]?.conversationId || order.subscriber_id,
                    };
                    const conversationDisplay = formatConversationDisplay(
                      conversationOverrides[order.rowNumber] ?? {
                        conversationId: order.subscriber_id,
                      },
                    );
                    const conversationStatus = getConversationStatus(effectiveOrder, conversationOverrides);
                    const disabledReason = sendDisabledReason(effectiveOrder);
                    return (
                      <tr key={`${order.rowNumber}:${order.id}`} className="border-b border-[var(--line)] last:border-0">
                        <td className="px-3 py-4">
                          <input
                            type="checkbox"
                            checked={Boolean(selectedRows[order.rowNumber])}
                            onChange={() => toggleRow(order.rowNumber)}
                            aria-label={`เลือกรายการ ${order.id || order.rowNumber}`}
                            className="size-4"
                          />
                        </td>
                        <td className="px-3 py-4 font-mono text-xs">{order.id || order.rowNumber}</td>
                        <td className="px-3 py-4 font-medium">{order.fb_name || "-"}</td>
                        <td className="px-3 py-4">{order.cod_amount === 0 ? "ไม่มี" : `${order.cod_amount.toLocaleString("th-TH")} บาท`}</td>
                        <td className="max-w-sm px-3 py-4">
                          <button
                            onClick={() => setPreviewOrder(order)}
                            className="line-clamp-2 text-left text-xs leading-5 text-[var(--muted)] hover:text-[var(--foreground)]"
                          >
                            {order.message}
                          </button>
                        </td>
                        <td className="px-3 py-4">
                          {effectiveOrder.subscriber_id ? (
                            <span className="block">
                              <span className="block font-medium">{conversationDisplay.primary}</span>
                              {conversationDisplay.secondary ? (
                                <span className="block font-mono text-xs text-[var(--muted)]">
                                  {conversationDisplay.secondary}
                                </span>
                              ) : null}
                            </span>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="px-3 py-4">
                          <ConversationStatusBadge status={conversationStatus} />
                        </td>
                        <td className="px-3 py-4">
                          <div className="flex flex-wrap gap-2">
                            <SmallButton onClick={() => setPreviewOrder(order)}>Preview</SmallButton>
                            <SmallButton
                              onClick={() => checkMatch(order)}
                              disabled={busyKey === `match:${order.rowNumber}` || !order.fb_name}
                            >
                              {busyKey === `match:${order.rowNumber}` ? "Searching" : "เลือก conversation"}
                            </SmallButton>
                            <SmallButton
                              onClick={() => setConfirmOrder(order)}
                              disabled={Boolean(disabledReason) || busyKey === `send:${order.rowNumber}`}
                              title={disabledReason}
                              primary
                            >
                              {order.send_status === "failed" ? "Retry" : "Confirm Send"}
                            </SmallButton>
                          </div>
                          {order.error ? <p className="mt-2 max-w-sm text-xs text-[var(--danger)]">{order.error}</p> : null}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {toast ? <ToastMessage toast={toast} onClose={() => setToast(null)} /> : null}
      {previewOrder ? <PreviewModal order={previewOrder} onClose={() => setPreviewOrder(null)} /> : null}
      {confirmOrder ? (
        <ConfirmModal
          order={confirmOrder}
          isBusy={busyKey === `send:${confirmOrder.rowNumber}`}
          onClose={() => setConfirmOrder(null)}
          onConfirm={() => sendMessage(confirmOrder)}
        />
      ) : null}
      {matchState ? (
        <MatchModal
          state={matchState}
          isBusy={busyKey === `select:${matchState.order.rowNumber}`}
          onChange={(manualValue) => setMatchState({ ...matchState, manualValue })}
          onClose={() => setMatchState(null)}
          onSelect={selectConversation}
        />
      ) : null}
      {isBatchConfirmOpen ? (
        <BatchConfirmModal
          isBusy={busyKey === "batch-send"}
          readyOrders={batchReadyOrders}
          selectedCount={selectedOrders.length}
          onClose={() => setIsBatchConfirmOpen(false)}
          onConfirm={sendSelectedMessages}
        />
      ) : null}
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-4 py-3 shadow-sm">
      <p className="text-xs font-medium uppercase text-[var(--muted)]">{label}</p>
      <p className="mt-1 font-mono text-2xl font-semibold">{value}</p>
    </div>
  );
}

function ActionButton({
  children,
  disabled,
  icon,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[var(--line)] bg-white px-3 text-sm font-medium hover:bg-[var(--panel-muted)] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {icon}
      {children}
    </button>
  );
}

function SmallButton({
  children,
  disabled,
  onClick,
  primary,
  title,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
  primary?: boolean;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex h-9 items-center justify-center rounded-md px-3 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
        primary
          ? "bg-[var(--accent)] text-white hover:bg-teal-800"
          : "border border-[var(--line)] bg-white hover:bg-[var(--panel-muted)]"
      }`}
    >
      {children}
    </button>
  );
}

function ConversationStatusBadge({ status }: { status: ReturnType<typeof getConversationStatus> }) {
  const className =
    status.tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : "border-rose-200 bg-rose-50 text-rose-700";

  return (
    <span className={`inline-flex min-h-7 items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${className}`}>
      {status.label}
    </span>
  );
}

function ToastMessage({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  return (
    <button
      onClick={onClose}
      className={`fixed bottom-4 right-4 z-50 flex max-w-sm items-center gap-2 rounded-md border bg-white px-4 py-3 text-left text-sm shadow-lg ${
        toast.type === "success" ? "border-emerald-200 text-emerald-800" : "border-rose-200 text-rose-800"
      }`}
    >
      <CheckCircle2 className="size-4 shrink-0" />
      {toast.message}
    </button>
  );
}

function ModalShell({
  children,
  title,
  onClose,
}: {
  children: React.ReactNode;
  title: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4">
      <section className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-lg bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-md px-2 py-1 text-sm hover:bg-[var(--panel-muted)]">
            Close
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

function PreviewModal({ order, onClose }: { order: TrackingOrder; onClose: () => void }) {
  return (
    <ModalShell title={`Preview: ${order.fb_name || order.customer_name}`} onClose={onClose}>
      <pre className="whitespace-pre-wrap rounded-md border border-[var(--line)] bg-[var(--panel-muted)] p-4 text-sm leading-6">
        {order.message}
      </pre>
    </ModalShell>
  );
}

function ConfirmModal({
  isBusy,
  onClose,
  onConfirm,
  order,
}: {
  isBusy: boolean;
  onClose: () => void;
  onConfirm: () => void;
  order: TrackingOrder;
}) {
  return (
    <ModalShell title={`ยืนยันส่งข้อความหา ${order.fb_name || order.customer_name}`} onClose={onClose}>
      <div className="grid gap-2 text-sm">
        <p>ชื่อผู้รับ: {order.customer_name || "-"}</p>
        <p>เลขพัสดุ: {order.tracking_no || "-"}</p>
        <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-md border border-[var(--line)] bg-[var(--panel-muted)] p-4 leading-6">
          {order.message}
        </pre>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <SmallButton onClick={onClose}>Cancel</SmallButton>
        <button
          onClick={onConfirm}
          disabled={isBusy}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[var(--accent)] px-4 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
        >
          {isBusy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          Confirm Send
        </button>
      </div>
    </ModalShell>
  );
}

function BatchConfirmModal({
  isBusy,
  onClose,
  onConfirm,
  readyOrders,
  selectedCount,
}: {
  isBusy: boolean;
  onClose: () => void;
  onConfirm: () => void;
  readyOrders: TrackingOrder[];
  selectedCount: number;
}) {
  return (
    <ModalShell title="ยืนยันส่งหลายรายการ" onClose={onClose}>
      <div className="space-y-3 text-sm">
        <p>
          เลือกไว้ {selectedCount} รายการ และพร้อมส่ง {readyOrders.length} รายการ
        </p>
        <div className="max-h-64 overflow-auto rounded-md border border-[var(--line)]">
          {readyOrders.map((order) => (
            <div key={order.rowNumber} className="border-b border-[var(--line)] px-3 py-2 last:border-0">
              <p className="font-medium">{order.fb_name || order.customer_name || `แถว ${order.rowNumber}`}</p>
              <p className="line-clamp-1 text-xs text-[var(--muted)]">{order.message}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <SmallButton onClick={onClose}>Cancel</SmallButton>
        <button
          onClick={onConfirm}
          disabled={isBusy || readyOrders.length === 0}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[var(--accent)] px-4 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
        >
          {isBusy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          Confirm Send {readyOrders.length} รายการ
        </button>
      </div>
    </ModalShell>
  );
}

function MatchModal({
  isBusy,
  onChange,
  onClose,
  onSelect,
  state,
}: {
  isBusy: boolean;
  onChange: (value: string) => void;
  onClose: () => void;
  onSelect: (conversationId: string) => void;
  state: MatchState;
}) {
  return (
    <ModalShell title={`เลือก Zernio conversation: ${state.order.fb_name}`} onClose={onClose}>
      <div className="space-y-3">
        {state.candidates.length > 0 ? (
          state.candidates.map((candidate) => (
            <button
              key={candidate.conversation_id}
              onClick={() => onSelect(candidate.conversation_id)}
              disabled={isBusy}
              className="flex w-full items-center justify-between rounded-md border border-[var(--line)] px-3 py-3 text-left hover:bg-[var(--panel-muted)] disabled:opacity-60"
            >
              <span>
                <span className="block font-medium">{candidate.name}</span>
                <span className="font-mono text-xs text-[var(--muted)]">
                  {candidate.conversation_id}
                  {candidate.platform ? ` · ${candidate.platform}` : ""}
                </span>
              </span>
              <UserCheck className="size-4" />
            </button>
          ))
        ) : (
          <p className="text-sm text-[var(--muted)]">ไม่พบจากชื่อ FB สามารถกรอก conversationId เองได้</p>
        )}
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={state.manualValue}
            onChange={(event) => onChange(event.target.value)}
            placeholder="conversationId"
            className="h-10 flex-1 rounded-md border border-[var(--line)] px-3 text-sm outline-none focus:border-[var(--accent)]"
          />
          <button
            onClick={() => onSelect(state.manualValue.trim())}
            disabled={!state.manualValue.trim() || isBusy}
            className="inline-flex h-10 items-center justify-center rounded-md bg-[var(--accent)] px-4 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
          >
            บันทึก
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
