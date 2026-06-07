import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { isRequestAuthenticated } from "@/lib/auth";
import { sendMessagesForRows } from "@/lib/orderActions";

const schema = z.object({
  items: z
    .array(
      z.object({
        rowNumber: z.number().int().positive(),
        subscriber_id: z.string().optional(),
      }),
    )
    .min(1),
});

export async function POST(request: NextRequest) {
  if (!isRequestAuthenticated(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    return NextResponse.json(await sendMessagesForRows(parsed.data.items, new Date()));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Batch send failed" },
      { status: 500 },
    );
  }
}
