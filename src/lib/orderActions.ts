import {
  getCachedConversationByName,
  getOrderByRowNumber,
  saveConversationCacheEntry,
  updateOrderCells,
} from "@/lib/googleSheets";
import { validateBeforeSend } from "@/lib/validation";
import { findConversationsByName, sendZernioInboxMessage } from "@/lib/zernio";

export async function matchSubscriberForRow(rowNumber: number, fb_name: string) {
  try {
    const cachedConversation = await getCachedConversationByName(fb_name);
    if (cachedConversation) {
      await updateOrderCells(rowNumber, {
        status: "พร้อมส่ง",
        match_status: "matched",
        error: "",
      });
      return {
        status: "matched" as const,
        subscriber_id: cachedConversation.conversation_id,
        subscriber: {
          conversation_id: cachedConversation.conversation_id,
          account_id: cachedConversation.account_id,
          name: cachedConversation.conversation_name || cachedConversation.fb_name,
          platform: cachedConversation.platform,
        },
      };
    }

    const candidates = await findConversationsByName(fb_name);

    if (candidates.length === 0) {
      await updateOrderCells(rowNumber, {
        status: "หาไม่เจอ",
        match_status: "not_found",
        error: "",
      });
      return { status: "not_found" as const };
    }

    if (candidates.length === 1) {
      const [subscriber] = candidates;
      await saveConversationCacheEntry({
        fb_name,
        conversation_id: subscriber.conversation_id,
        conversation_name: subscriber.name,
        platform: subscriber.platform,
        account_id: subscriber.account_id,
        match_status: "matched",
      });
      await updateOrderCells(rowNumber, {
        status: "พร้อมส่ง",
        match_status: "matched",
        error: "",
      });
      return {
        status: "matched" as const,
        subscriber_id: subscriber.conversation_id,
        subscriber,
      };
    }

    await updateOrderCells(rowNumber, {
      status: "ต้องเลือก",
      match_status: "multiple_matches",
      error: "",
    });
    return {
      status: "multiple_matches" as const,
      candidates,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown matching error";
    await updateOrderCells(rowNumber, {
      status: "หาไม่เจอ",
      match_status: "error",
      error: message,
    });
    return { status: "error" as const, error: message };
  }
}

export async function selectSubscriberForRow(rowNumber: number, subscriber_id: string) {
  const order = await getOrderByRowNumber(rowNumber);
  await saveConversationCacheEntry({
    fb_name: order?.fb_name || subscriber_id,
    conversation_id: subscriber_id,
    conversation_name: order?.fb_name || "",
    platform: "",
    account_id: "",
    match_status: "manual",
  });

  await updateOrderCells(rowNumber, {
    status: "พร้อมส่ง",
    match_status: "matched",
    error: "",
  });

  return { status: "success" as const };
}

export async function sendMessageForRow(rowNumber: number, now = new Date(), selectedSubscriberId = "") {
  const order = await getOrderByRowNumber(rowNumber);

  if (!order) {
    return { status: "failed" as const, error: "ไม่พบรายการใน Google Sheet" };
  }

  const cachedConversation =
    selectedSubscriberId.trim() || order.subscriber_id ? null : await getCachedConversationByName(order.fb_name);
  const cachedSubscriberId = cachedConversation?.conversation_id ?? "";
  const orderToSend = {
    ...order,
    subscriber_id: selectedSubscriberId.trim() || order.subscriber_id || cachedSubscriberId,
    match_status: selectedSubscriberId.trim() || cachedSubscriberId ? ("matched" as const) : order.match_status,
  };
  const validationError = validateBeforeSend(orderToSend);
  if (validationError) {
    await updateOrderCells(rowNumber, {
      status: validationError.includes("conversationId") ? "หาไม่เจอ" : "ส่งไม่สำเร็จ",
      send_status: "failed",
      error: validationError,
    });
    return { status: "failed" as const, error: validationError };
  }

  try {
    await sendZernioInboxMessage(orderToSend.subscriber_id, orderToSend.message);
    const sent_at = now.toISOString();
    await updateOrderCells(rowNumber, {
      status: "ส่งแล้ว",
      send_status: "sent",
      sent_at,
      error: "",
    });
    return { status: "sent" as const, sent_at };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown sending error";
    await updateOrderCells(rowNumber, {
      status: "ส่งไม่สำเร็จ",
      send_status: "failed",
      error: message,
    });
    return { status: "failed" as const, error: message };
  }
}
