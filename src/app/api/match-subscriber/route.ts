import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { isRequestAuthenticated } from "@/lib/auth";
import { matchSubscriberForRow } from "@/lib/orderActions";

const schema = z.object({
  rowNumber: z.number().int().positive(),
  fb_name: z.string().min(1),
});

export async function POST(request: NextRequest) {
  if (!isRequestAuthenticated(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  return NextResponse.json(await matchSubscriberForRow(parsed.data.rowNumber, parsed.data.fb_name));
}
