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
import { measureCatalogPayload } from "@/lib/catalog/payload-budget";

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
    const payloadSize = measureCatalogPayload(response);

    if (!payloadSize.withinBudget) {
      logServerError("catalog-payload-budget", new Error("CATALOG_PAYLOAD_TOO_LARGE"));
    }

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "private, no-store",
        "Server-Timing": `catalog-payload;desc=gzip-${String(payloadSize.gzipBytes)}-bytes`,
        "X-Catalog-Gzip-Bytes": String(payloadSize.gzipBytes),
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
