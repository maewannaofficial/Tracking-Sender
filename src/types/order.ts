export type MatchStatus =
  | "pending"
  | "matched"
  | "multiple_matches"
  | "not_found"
  | "error";

export type SendStatus = "pending" | "sent" | "failed" | "skipped";

export type OrderStatusFilter = SendStatus | MatchStatus | "all";

export interface TrackingOrder {
  rowNumber: number;
  id: string;
  fb_name: string;
  tracking_no: string;
  customer_name: string;
  cod_amount: number;
  message: string;
  subscriber_id: string;
  match_status: MatchStatus;
  send_status: SendStatus;
  sent_at: string;
  error: string;
}

export interface ZernioConversationCandidate {
  conversation_id: string;
  account_id: string;
  name: string;
  platform: string;
}
