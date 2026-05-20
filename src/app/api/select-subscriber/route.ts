import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { isRequestAuthenticated } from "@/lib/auth";
import { selectSubscriberForRow } from "@/lib/orderActions";

const schema = z.object({
  rowNumber: z.number().int().positive(),
  subscriber_id: z.string().min(1),
});

export async function POST(request: NextRequest) {
  if (!isRequestAuthenticated(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  return NextResponse.json(await selectSubscriberForRow(parsed.data.rowNumber, parsed.data.subscriber_id));
}
