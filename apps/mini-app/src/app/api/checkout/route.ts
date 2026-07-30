import { checkoutResponseSchema } from "@kids-store/shared";
import { NextResponse } from "next/server";

import {
  handleMiniAppApiError,
  parseJsonBody,
} from "@/lib/api/route-error";
import { authenticateMiniAppRequest } from "@/lib/auth/request-auth";
import { checkoutCart } from "@/lib/checkout/checkout.service";
import {
  sendCheckoutNotifications,
} from "@/lib/checkout/notification.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  request: Request,
): Promise<NextResponse> {
  try {
    const user = authenticateMiniAppRequest(request);
    const input = await parseJsonBody(request);
    const result = await checkoutCart(user, input);

    if (!result.wasDuplicate) {
      await sendCheckoutNotifications(user, result.order);
    }

    const response = checkoutResponseSchema.parse({
      data: result,
    });

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return handleMiniAppApiError(error, "checkout-cart");
  }
}
