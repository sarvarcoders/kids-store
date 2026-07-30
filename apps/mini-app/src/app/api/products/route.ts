import {
  productListResponseSchema,
  productQuerySchema,
} from "@kids-store/shared";
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
import { listCatalogProducts } from "@/lib/catalog/catalog.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    authenticateMiniAppRequest(request);
    const url = new URL(request.url);
    const parsedQuery = productQuerySchema.safeParse(
      Object.fromEntries(url.searchParams),
    );

    if (!parsedQuery.success) {
      return createApiErrorResponse(
        400,
        "INVALID_PRODUCT_QUERY",
        "Qidiruv yoki sahifalash parametrlari noto‘g‘ri.",
      );
    }

    const products = await listCatalogProducts(parsedQuery.data);
    const response = productListResponseSchema.parse(products);

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof MiniAppAuthenticationError) {
      return createAuthenticationErrorResponse(error);
    }

    logServerError("list-products", error);
    return createApiErrorResponse(
      500,
      "CATALOG_UNAVAILABLE",
      "Mahsulotlarni yuklab bo‘lmadi. Keyinroq qayta urinib ko‘ring.",
    );
  }
}
