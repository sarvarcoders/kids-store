import { catalogResponseSchema } from "@kids-store/shared";
import { NextResponse } from "next/server";

import {
  createApiErrorResponse,
  createAuthenticationErrorResponse,
  logServerError,
} from "@/lib/api/response";
import {
  authenticateMiniAppRequest,
  MiniAppAuthenticationError,
} from "@/lib/auth/request-auth";
import { getCartQuantityForTelegramUser } from "@/lib/cart/cart.service";
import { getCachedCatalogData } from "@/lib/catalog/catalog-cache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const user = authenticateMiniAppRequest(request);
    const [catalog, cartQuantity] = await Promise.all([
      getCachedCatalogData(),
      getCartQuantityForTelegramUser(user),
    ]);
    const response = catalogResponseSchema.parse({
      ...catalog,
      user,
      cartQuantity,
    });

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof MiniAppAuthenticationError) {
      return createAuthenticationErrorResponse();
    }

    logServerError("get-catalog", error);
    return createApiErrorResponse(
      500,
      "CATALOG_UNAVAILABLE",
      "Katalogni yuklab bo‘lmadi. Keyinroq qayta urinib ko‘ring.",
    );
  }
}
