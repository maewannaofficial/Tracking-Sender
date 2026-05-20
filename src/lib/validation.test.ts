import { describe, expect, it } from "vitest";

import { validateBeforeSend } from "./validation";
import type { TrackingOrder } from "@/types/order";

const readyOrder: TrackingOrder = {
  rowNumber: 2,
  id: "1",
  fb_name: "Nan Napat",
  tracking_no: "TH123456789",
  customer_name: "คุณแนน",
  cod_amount: 0,
  message: "tracking message",
  subscriber_id: "123456789",
  match_status: "matched",
  send_status: "pending",
  sent_at: "",
  error: "",
};

describe("validateBeforeSend", () => {
  it("allows a matched pending order with subscriber, tracking number, and message", () => {
    expect(validateBeforeSend(readyOrder)).toBeNull();
  });

  it.each([
    ["send_status", { send_status: "sent" }, "รายการนี้ส่งไปแล้ว"],
    ["subscriber_id", { subscriber_id: "" }, "ไม่มี conversationId"],
    ["message", { message: "" }, "ไม่มีข้อความสำหรับส่ง"],
  ] as const)("rejects invalid %s", (_field, patch, expected) => {
    expect(validateBeforeSend({ ...readyOrder, ...patch })).toBe(expected);
  });

  it("does not require tracking number or matched status when a subscriber id is provided manually", () => {
    expect(
      validateBeforeSend({
        ...readyOrder,
        tracking_no: "",
        match_status: "pending",
      }),
    ).toBeNull();
  });
});
