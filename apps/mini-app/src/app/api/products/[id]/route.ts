import {
  productDetailResponseSchema,
  productIdSchema,
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
import { getCatalogProductById } from "@/lib/catalog/catalog.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface ProductRouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(
  request: Request,
  context: ProductRouteContext,
): Promise<NextResponse> {
  try {
    authenticateMiniAppRequest(request);
    const { id } = await context.params;
    const parsedProductId = productIdSchema.safeParse(id);

    if (!parsedProductId.success) {
      return createApiErrorResponse(
        400,
        "INVALID_PRODUCT_ID",
        "Mahsulot ID noto‘g‘ri.",
      );
    }

    const product = await getCatalogProductById(parsedProductId.data);

    if (!product) {
      return createApiErrorResponse(
        404,
        "PRODUCT_NOT_FOUND",
        "Mahsulot topilmadi yoki hozir sotuvda mavjud emas.",
      );
    }

    const response = productDetailResponseSchema.parse({
      data: product,
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

    logServerError("get-product", error);
    return createApiErrorResponse(
      500,
      "CATALOG_UNAVAILABLE",
      "Mahsulotni yuklab bo‘lmadi. Keyinroq qayta urinib ko‘ring.",
    );
  }
}
