import { describe, expect, it } from "vitest";

import {
  getAutoMatchTargets,
  getBatchReadyOrders,
  getConversationStatus,
  getDashboardStats,
  type ConversationOverrideMap,
} from "./dashboardBulkActions";
import type { TrackingOrder } from "@/types/order";

const baseOrder: TrackingOrder = {
  rowNumber: 2,
  id: "2",
  fb_name: "Nan Napat",
  tracking_no: "",
  customer_name: "Nan Napat",
  cod_amount: 0,
  message: "tracking message",
  subscriber_id: "",
  match_status: "pending",
  send_status: "pending",
  sent_at: "",
  error: "",
};

describe("dashboard bulk helpers", () => {
  it("auto-matches rows that have a name and no conversation yet", () => {
    const overrides: ConversationOverrideMap = {
      4: { conversationId: "conversation_4", name: "Already Matched" },
    };
    const attempted = new Set([5]);

    expect(
      getAutoMatchTargets(
        [
          baseOrder,
          { ...baseOrder, rowNumber: 3, fb_name: "" },
          { ...baseOrder, rowNumber: 4 },
          { ...baseOrder, rowNumber: 5 },
          { ...baseOrder, rowNumber: 6, subscriber_id: "conversation_6" },
          { ...baseOrder, rowNumber: 7, send_status: "sent" },
        ],
        overrides,
        attempted,
      ).map((order) => order.rowNumber),
    ).toEqual([2, 7]);
  });

  it("returns selected rows that have a conversation and message for batch sending", () => {
    const overrides: ConversationOverrideMap = {
      2: { conversationId: "conversation_2", name: "Nan Napat" },
    };
    const selected = new Set([2, 3, 4, 5]);

    expect(
      getBatchReadyOrders(
        [
          baseOrder,
          { ...baseOrder, rowNumber: 3, subscriber_id: "conversation_3" },
          { ...baseOrder, rowNumber: 4, message: "" },
          { ...baseOrder, rowNumber: 5, send_status: "sent", subscriber_id: "conversation_5" },
        ],
        selected,
        overrides,
      ).map((order) => order.rowNumber),
    ).toEqual([2, 3]);
  });

  it("shows Found only when a row has a conversation id", () => {
    const overrides: ConversationOverrideMap = {
      3: { conversationId: "conversation_3", name: "Matched Name" },
    };

    expect(getConversationStatus({ ...baseOrder, subscriber_id: "conversation_2" }, {})).toEqual({
      label: "Found",
      tone: "success",
    });
    expect(getConversationStatus({ ...baseOrder, rowNumber: 3 }, overrides)).toEqual({
      label: "Found",
      tone: "success",
    });
    expect(getConversationStatus(baseOrder, {})).toEqual({
      label: "Not found",
      tone: "danger",
    });
  });

  it("counts totals, Found, and Not found only for rows with an FB name", () => {
    const overrides: ConversationOverrideMap = {
      4: { conversationId: "conversation_4", name: "Matched Name" },
    };

    expect(
      getDashboardStats(
        [
          baseOrder,
          { ...baseOrder, rowNumber: 3, fb_name: "", subscriber_id: "conversation_3" },
          { ...baseOrder, rowNumber: 4 },
          { ...baseOrder, rowNumber: 5, fb_name: "  " },
          { ...baseOrder, rowNumber: 6, subscriber_id: "conversation_6" },
        ],
        overrides,
      ),
    ).toEqual({
      total: 3,
      found: 2,
      notFound: 1,
      sent: 0,
    });
  });
});
