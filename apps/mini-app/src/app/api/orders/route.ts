import {
  orderListResponseSchema,
  orderQuerySchema,
} from "@kids-store/shared";
import { NextResponse } from "next/server";

import { handleMiniAppApiError } from "@/lib/api/route-error";
import { authenticateMiniAppRequest } from "@/lib/auth/request-auth";
import {
  listOrdersForTelegramUser,
} from "@/lib/orders/orders.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const user = authenticateMiniAppRequest(request);
    const url = new URL(request.url);
    const query = orderQuerySchema.parse(
      Object.fromEntries(url.searchParams),
    );
    const orders = await listOrdersForTelegramUser(user, query);
    const response = orderListResponseSchema.parse(orders);

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return handleMiniAppApiError(error, "list-orders");
  }
}
