import { cartResponseSchema } from "@kids-store/shared";
import { NextResponse } from "next/server";

import {
  handleMiniAppApiError,
  parseJsonBody,
} from "@/lib/api/route-error";
import { authenticateMiniAppRequest } from "@/lib/auth/request-auth";
import { addCartItem } from "@/lib/cart/cart.service";
import { createApiErrorResponse } from "@/lib/api/response";
import { consumeMutationPermit } from "@/lib/rate-limit/mutation-rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  request: Request,
): Promise<NextResponse> {
  try {
    const user = authenticateMiniAppRequest(request);

    if (!consumeMutationPermit("cart", user.id)) {
      return createApiErrorResponse(
        429,
        "RATE_LIMITED",
        "Juda tez so‘rov yuborildi. Bir oz kutib qayta urinib ko‘ring.",
      );
    }

    const input = await parseJsonBody(request);
    const cart = await addCartItem(user, input);
    const response = cartResponseSchema.parse({ data: cart });

    return NextResponse.json(response, {
      status: 201,
      headers: {
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return handleMiniAppApiError(error, "add-cart-item");
  }
}
