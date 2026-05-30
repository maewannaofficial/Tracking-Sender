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

export function getConversationStatus(order: TrackingOrder, overrides: ConversationOverrideMap) {
  return getConversationId(order, overrides)
    ? { label: "Found", tone: "success" as const }
    : { label: "Not found", tone: "danger" as const };
}

export function getDashboardStats(orders: TrackingOrder[], overrides: ConversationOverrideMap) {
  const ordersWithFbName = orders.filter((order) => Boolean(order.fb_name.trim()));
  const found = ordersWithFbName.filter((order) => Boolean(getConversationId(order, overrides))).length;

  return {
    total: ordersWithFbName.length,
    found,
    notFound: ordersWithFbName.length - found,
    sent: ordersWithFbName.filter((order) => order.send_status === "sent").length,
  };
}
