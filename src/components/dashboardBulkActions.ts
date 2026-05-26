import type { ConversationDisplayInput } from "@/components/conversationDisplay";
import type { TrackingOrder } from "@/types/order";

export type ConversationOverrideMap = Record<number, ConversationDisplayInput>;

export function getConversationId(order: TrackingOrder, overrides: ConversationOverrideMap) {
  return overrides[order.rowNumber]?.conversationId || order.subscriber_id;
}

export function getAutoMatchTargets(
  orders: TrackingOrder[],
  overrides: ConversationOverrideMap,
  attemptedRowNumbers: Set<number>,
) {
  return orders.filter(
    (order) =>
      order.send_status !== "sent" &&
      Boolean(order.fb_name.trim()) &&
      !getConversationId(order, overrides) &&
      !attemptedRowNumbers.has(order.rowNumber),
  );
}

export function getBatchReadyOrders(
  orders: TrackingOrder[],
  selectedRowNumbers: Set<number>,
  overrides: ConversationOverrideMap,
) {
  return orders.filter(
    (order) =>
      selectedRowNumbers.has(order.rowNumber) &&
      order.send_status !== "sent" &&
      Boolean(order.message.trim()) &&
      Boolean(getConversationId(order, overrides)),
  );
}

export function getDashboardRowStatus(order: TrackingOrder, overrides: ConversationOverrideMap) {
  if (order.send_status === "sent") {
    return { label: "ส่งแล้ว", tone: "success" as const };
  }

  if (order.send_status === "failed") {
    return { label: "ส่งไม่สำเร็จ", tone: "danger" as const };
  }

  if (!order.message.trim()) {
    return { label: "ไม่มีข้อความ", tone: "danger" as const };
  }

  if (order.match_status === "multiple_matches") {
    return { label: "ต้องเลือก", tone: "warning" as const };
  }

  if (order.match_status === "error") {
    return { label: "หาไม่เจอ", tone: "danger" as const };
  }

  if (!getConversationId(order, overrides) || order.match_status === "not_found") {
    return { label: "หาไม่เจอ", tone: "danger" as const };
  }

  return { label: "พร้อมส่ง", tone: "success" as const };
}
