import { cartResponseSchema } from "@kids-store/shared";
import { NextResponse } from "next/server";

import {
  handleMiniAppApiError,
  parseJsonBody,
} from "@/lib/api/route-error";
import { authenticateMiniAppRequest } from "@/lib/auth/request-auth";
import {
  removeCartItem,
  updateCartItemQuantity,
} from "@/lib/cart/cart.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface CartItemRouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function PATCH(
  request: Request,
  context: CartItemRouteContext,
): Promise<NextResponse> {
  try {
    const user = authenticateMiniAppRequest(request);
    const input = await parseJsonBody(request);
    const { id } = await context.params;
    const cart = await updateCartItemQuantity(user, id, input);
    const response = cartResponseSchema.parse({ data: cart });

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return handleMiniAppApiError(error, "update-cart-item");
  }
}

export async function DELETE(
  request: Request,
  context: CartItemRouteContext,
): Promise<NextResponse> {
  try {
    const user = authenticateMiniAppRequest(request);
    const { id } = await context.params;
    const cart = await removeCartItem(user, id);
    const response = cartResponseSchema.parse({ data: cart });

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return handleMiniAppApiError(error, "remove-cart-item");
  }
}
