import {
  orderDetailResponseSchema,
  productIdSchema,
} from "@kids-store/shared";
import { NextResponse } from "next/server";

import {
  createApiErrorResponse,
} from "@/lib/api/response";
import { handleMiniAppApiError } from "@/lib/api/route-error";
import { authenticateMiniAppRequest } from "@/lib/auth/request-auth";
import {
  getOrderForTelegramUser,
} from "@/lib/orders/orders.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface OrderRouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(
  request: Request,
  context: OrderRouteContext,
): Promise<NextResponse> {
  try {
    const user = authenticateMiniAppRequest(request);
    const { id } = await context.params;
    const orderId = productIdSchema.parse(id);
    const order = await getOrderForTelegramUser(user, orderId);

    if (!order) {
      return createApiErrorResponse(
        404,
        "ORDER_NOT_FOUND",
        "Buyurtma topilmadi.",
      );
    }

    const response = orderDetailResponseSchema.parse({
      data: order,
    });

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return handleMiniAppApiError(error, "get-order");
  }
}
