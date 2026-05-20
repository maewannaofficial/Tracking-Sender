import { NextResponse, type NextRequest } from "next/server";

import { isRequestAuthenticated } from "@/lib/auth";
import { getOrders } from "@/lib/googleSheets";

export async function GET(request: NextRequest) {
  if (!isRequestAuthenticated(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const status = request.nextUrl.searchParams.get("status");
    return NextResponse.json({ orders: await getOrders(status) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load orders" },
      { status: 500 },
    );
  }
}
