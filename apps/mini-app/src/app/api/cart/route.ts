import { cartResponseSchema } from "@kids-store/shared";
import { NextResponse } from "next/server";

import {
  authenticateMiniAppRequest,
} from "@/lib/auth/request-auth";
import {
  clearCart,
  getCartForTelegramUser,
} from "@/lib/cart/cart.service";
import { handleMiniAppApiError } from "@/lib/api/route-error";
import { createApiErrorResponse } from "@/lib/api/response";
import { consumeMutationPermit } from "@/lib/rate-limit/mutation-rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const user = authenticateMiniAppRequest(request);
    const cart = await getCartForTelegramUser(user);
    const response = cartResponseSchema.parse({ data: cart });

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return handleMiniAppApiError(error, "get-cart");
  }
}

export async function DELETE(
  request: Request,
): Promise<NextResponse> {
  try {
    const user = authenticateMiniAppRequest(request);

    if (!(await consumeMutationPermit("cart", user.id))) {
      return createApiErrorResponse(
        429,
        "RATE_LIMITED",
        "Juda tez so‘rov yuborildi. Bir oz kutib qayta urinib ko‘ring.",
      );
    }

    const cart = await clearCart(user);
    const response = cartResponseSchema.parse({ data: cart });

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return handleMiniAppApiError(error, "clear-cart");
  }
}
