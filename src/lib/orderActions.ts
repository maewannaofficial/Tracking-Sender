import { getOrderByRowNumber, updateOrderCells } from "@/lib/googleSheets";
import { validateBeforeSend } from "@/lib/validation";
import { findConversationsByName, sendZernioInboxMessage } from "@/lib/zernio";

export async function matchSubscriberForRow(rowNumber: number, fb_name: string) {
  try {
    const candidates = await findConversationsByName(fb_name);

    if (candidates.length === 0) {
      await updateOrderCells(rowNumber, {
        error: "",
      });
      return { status: "not_found" as const };
    }

    if (candidates.length === 1) {
      const [subscriber] = candidates;
      await updateOrderCells(rowNumber, {
        subscriber_id: subscriber.conversation_id,
        error: "",
      });
      return {
        status: "matched" as const,
        subscriber_id: subscriber.conversation_id,
        subscriber,
      };
    }

    await updateOrderCells(rowNumber, {
      error: "",
    });
    return {
      status: "multiple_matches" as const,
      candidates,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown matching error";
    await updateOrderCells(rowNumber, {
      error: message,
    });
    return { status: "error" as const, error: message };
  }
}

export async function selectSubscriberForRow(rowNumber: number, subscriber_id: string) {
  await updateOrderCells(rowNumber, {
    subscriber_id,
    error: "",
  });

  return { status: "success" as const };
}

export async function sendMessageForRow(rowNumber: number, now = new Date(), selectedSubscriberId = "") {
  const order = await getOrderByRowNumber(rowNumber);

  if (!order) {
    return { status: "failed" as const, error: "ไม่พบรายการใน Google Sheet" };
  }

  const orderToSend = {
    ...order,
    subscriber_id: selectedSubscriberId.trim() || order.subscriber_id,
    match_status: selectedSubscriberId.trim() ? ("matched" as const) : order.match_status,
  };
  const validationError = validateBeforeSend(orderToSend);
  if (validationError) {
    return { status: "failed" as const, error: validationError };
  }

  try {
    await sendZernioInboxMessage(orderToSend.subscriber_id, orderToSend.message);
    const sent_at = now.toISOString();
    await updateOrderCells(rowNumber, {
      send_status: "sent",
      sent_at,
      error: "",
    });
    return { status: "sent" as const, sent_at };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown sending error";
    await updateOrderCells(rowNumber, {
      send_status: "failed",
      error: message,
    });
    return { status: "failed" as const, error: message };
  }
}
