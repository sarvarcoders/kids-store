import { authSessionResponseSchema } from "@kids-store/shared";
import { NextResponse } from "next/server";

import {
  createAuthenticationErrorResponse,
} from "@/lib/api/response";
import { authenticateMiniAppRequest } from "@/lib/auth/request-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET(request: Request): NextResponse {
  try {
    const user = authenticateMiniAppRequest(request);
    const response = authSessionResponseSchema.parse({
      data: {
        user,
      },
    });

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return createAuthenticationErrorResponse(error);
  }
}
