import { categoryListResponseSchema } from "@kids-store/shared";
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
import { listCatalogCategories } from "@/lib/catalog/catalog.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    authenticateMiniAppRequest(request);
    const categories = await listCatalogCategories();
    const response = categoryListResponseSchema.parse({
      data: categories,
    });

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof MiniAppAuthenticationError) {
      return createAuthenticationErrorResponse(error);
    }

    logServerError("list-categories", error);
    return createApiErrorResponse(
      500,
      "CATALOG_UNAVAILABLE",
      "Kategoriyalarni yuklab bo‘lmadi. Keyinroq qayta urinib ko‘ring.",
    );
  }
}
