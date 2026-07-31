import { hasMatchingRevalidationSecret } from "@kids-store/core";
import { NextResponse } from "next/server";

import { createApiErrorResponse } from "@/lib/api/response";
import { invalidateCatalogCache } from "@/lib/catalog/catalog-cache";
import { serverEnv } from "@/lib/env/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function POST(request: Request): NextResponse {
  const secret = serverEnv.CACHE_REVALIDATION_SECRET;

  if (
    secret === undefined ||
    !hasMatchingRevalidationSecret(
      request.headers.get("x-cache-revalidation-secret"),
      secret,
    )
  ) {
    return createApiErrorResponse(401, "UNAUTHORIZED", "Unauthorized");
  }

  invalidateCatalogCache();

  return NextResponse.json(
    { revalidated: true },
    { headers: { "Cache-Control": "no-store" } },
  );
}
