import type { TrackingOrder } from "@/types/order";

export function validateBeforeSend(order: TrackingOrder) {
  if (order.send_status === "sent") {
    return "รายการนี้ส่งไปแล้ว";
  }

  if (!order.subscriber_id.trim()) {
    return "ไม่มี conversationId";
  }

  if (!order.message.trim()) {
    return "ไม่มีข้อความสำหรับส่ง";
  }

  return null;
}
