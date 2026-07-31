import { checkoutResponseSchema } from "@kids-store/shared";
import { after, NextResponse } from "next/server";

import {
  handleMiniAppApiError,
  parseJsonBody,
} from "@/lib/api/route-error";
import { authenticateMiniAppRequest } from "@/lib/auth/request-auth";
import { createApiErrorResponse } from "@/lib/api/response";
import { checkoutCart } from "@/lib/checkout/checkout.service";
import {
  sendCheckoutNotifications,
} from "@/lib/checkout/notification.service";
import { consumeMutationPermit } from "@/lib/rate-limit/mutation-rate-limit";
import { invalidateCatalogCache } from "@/lib/catalog/catalog-cache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  request: Request,
): Promise<NextResponse> {
  try {
    const user = authenticateMiniAppRequest(request);

    if (!(await consumeMutationPermit("checkout", user.id))) {
      return createApiErrorResponse(
        429,
        "RATE_LIMITED",
        "Buyurtma juda tez yuborildi. Bir oz kutib qayta urinib ko‘ring.",
      );
    }

    const input = await parseJsonBody(request);
    const result = await checkoutCart(user, input);

    if (!result.wasDuplicate) {
      invalidateCatalogCache();
      after(async () => {
        await sendCheckoutNotifications(user, result.order);
      });
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
