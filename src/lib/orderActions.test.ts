import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TrackingOrder } from "@/types/order";
import { matchSubscriberForRow, selectSubscriberForRow, sendMessageForRow } from "./orderActions";

const {
  findConversationsByName,
  sendZernioInboxMessage,
  getCachedConversationByName,
  getOrderByRowNumber,
  saveConversationCacheEntry,
  updateOrderCells,
} =
  vi.hoisted(() => ({
    findConversationsByName: vi.fn(),
    sendZernioInboxMessage: vi.fn(),
    getCachedConversationByName: vi.fn(),
    getOrderByRowNumber: vi.fn(),
    saveConversationCacheEntry: vi.fn(),
    updateOrderCells: vi.fn(),
  }));

vi.mock("./zernio", () => ({
  findConversationsByName,
  sendZernioInboxMessage,
}));

vi.mock("./googleSheets", () => ({
  getCachedConversationByName,
  getOrderByRowNumber,
  saveConversationCacheEntry,
  updateOrderCells,
}));

const readyOrder: TrackingOrder = {
  rowNumber: 2,
  id: "1",
  fb_name: "Nan Napat",
  tracking_no: "TH123456789",
  customer_name: "คุณแนน",
  cod_amount: 0,
  message: "tracking message",
  subscriber_id: "conversation_123",
  match_status: "matched",
  send_status: "pending",
  sent_at: "",
  error: "",
};

describe("orderActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCachedConversationByName.mockResolvedValue(null);
  });

  it("uses a cached conversation id from the conversation_id sheet before calling Zernio", async () => {
    getCachedConversationByName.mockResolvedValue({
      fb_name: "Nan Napat",
      conversation_id: "cached_conversation_123",
      conversation_name: "Nan Napat",
      platform: "facebook",
      account_id: "account_1",
      match_status: "matched",
      last_matched_at: "2026-05-19T08:00:00.000Z",
      note: "",
    });

    await expect(matchSubscriberForRow(2, "Nan Napat")).resolves.toEqual({
      status: "matched",
      subscriber_id: "cached_conversation_123",
      subscriber: {
        conversation_id: "cached_conversation_123",
        account_id: "account_1",
        name: "Nan Napat",
        platform: "facebook",
      },
    });
    expect(findConversationsByName).not.toHaveBeenCalled();
    expect(updateOrderCells).toHaveBeenCalledWith(2, {
      status: "พร้อมส่ง",
      match_status: "matched",
      error: "",
    });
  });

  it("marks a row matched when Zernio returns exactly one conversation", async () => {
    findConversationsByName.mockResolvedValue([
      { conversation_id: "conversation_123", account_id: "account_1", name: "Nan Napat", platform: "facebook" },
    ]);

    await expect(matchSubscriberForRow(2, "Nan Napat")).resolves.toEqual({
      status: "matched",
      subscriber_id: "conversation_123",
      subscriber: {
        conversation_id: "conversation_123",
        account_id: "account_1",
        name: "Nan Napat",
        platform: "facebook",
      },
    });
    expect(updateOrderCells).toHaveBeenCalledWith(2, {
      status: "พร้อมส่ง",
      match_status: "matched",
      error: "",
    });
    expect(saveConversationCacheEntry).toHaveBeenCalledWith({
      fb_name: "Nan Napat",
      conversation_id: "conversation_123",
      conversation_name: "Nan Napat",
      platform: "facebook",
      account_id: "account_1",
      match_status: "matched",
    });
  });

  it("returns candidates and marks multiple matches when Zernio finds more than one conversation", async () => {
    const candidates = [
      { conversation_id: "conversation_123", account_id: "account_1", name: "Nan Napat", platform: "facebook" },
      { conversation_id: "conversation_456", account_id: "account_1", name: "Nann Napat", platform: "facebook" },
    ];
    findConversationsByName.mockResolvedValue(candidates);

    await expect(matchSubscriberForRow(2, "Nan Napat")).resolves.toEqual({
      status: "multiple_matches",
      candidates,
    });
    expect(updateOrderCells).toHaveBeenCalledWith(2, {
      status: "ต้องเลือก",
      match_status: "multiple_matches",
      error: "",
    });
  });

  it("lets an admin manually select a conversation id", async () => {
    getOrderByRowNumber.mockResolvedValue(readyOrder);

    await expect(selectSubscriberForRow(2, "conversation_456")).resolves.toEqual({ status: "success" });
    expect(updateOrderCells).toHaveBeenCalledWith(2, {
      status: "พร้อมส่ง",
      match_status: "matched",
      error: "",
    });
    expect(saveConversationCacheEntry).toHaveBeenCalledWith({
      fb_name: "Nan Napat",
      conversation_id: "conversation_456",
      conversation_name: "Nan Napat",
      platform: "",
      account_id: "",
      match_status: "manual",
    });
  });

  it("rereads the row, sends the message, and records sent status", async () => {
    getOrderByRowNumber.mockResolvedValue(readyOrder);
    sendZernioInboxMessage.mockResolvedValue({ success: true });

    await expect(sendMessageForRow(2, new Date("2026-05-19T08:00:00.000Z"))).resolves.toEqual({
      status: "sent",
      sent_at: "2026-05-19T08:00:00.000Z",
    });
    expect(sendZernioInboxMessage).toHaveBeenCalledWith("conversation_123", "tracking message");
    expect(updateOrderCells).toHaveBeenCalledWith(2, {
      status: "ส่งแล้ว",
      send_status: "sent",
      sent_at: "2026-05-19T08:00:00.000Z",
      error: "",
    });
  });

  it("can send with a subscriber id selected in the UI without requiring it in the sheet row", async () => {
    getOrderByRowNumber.mockResolvedValue({ ...readyOrder, subscriber_id: "", match_status: "pending" });
    sendZernioInboxMessage.mockResolvedValue({ success: true });

    await expect(
      sendMessageForRow(2, new Date("2026-05-19T08:00:00.000Z"), "conversation_999"),
    ).resolves.toEqual({
      status: "sent",
      sent_at: "2026-05-19T08:00:00.000Z",
    });
    expect(sendZernioInboxMessage).toHaveBeenCalledWith("conversation_999", "tracking message");
  });

  it("can send with a cached conversation id without requiring it in the main sheet row", async () => {
    getOrderByRowNumber.mockResolvedValue({ ...readyOrder, subscriber_id: "", match_status: "pending" });
    getCachedConversationByName.mockResolvedValue({
      fb_name: "Nan Napat",
      conversation_id: "cached_conversation_123",
      conversation_name: "Nan Napat",
      platform: "facebook",
      account_id: "account_1",
      match_status: "matched",
      last_matched_at: "2026-05-19T08:00:00.000Z",
      note: "",
    });
    sendZernioInboxMessage.mockResolvedValue({ success: true });

    await expect(sendMessageForRow(2, new Date("2026-05-19T08:00:00.000Z"))).resolves.toEqual({
      status: "sent",
      sent_at: "2026-05-19T08:00:00.000Z",
    });
    expect(sendZernioInboxMessage).toHaveBeenCalledWith("cached_conversation_123", "tracking message");
  });

  it("does not send when validation fails", async () => {
    getOrderByRowNumber.mockResolvedValue({ ...readyOrder, send_status: "sent" });

    await expect(sendMessageForRow(2)).resolves.toEqual({
      status: "failed",
      error: "รายการนี้ส่งไปแล้ว",
    });
    expect(sendZernioInboxMessage).not.toHaveBeenCalled();
  });
});
