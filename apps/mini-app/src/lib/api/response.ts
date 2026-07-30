import {
  apiErrorResponseSchema,
  type ApiErrorResponse,
} from "@kids-store/shared";
import { NextResponse } from "next/server";

export function createApiErrorResponse(
  status: number,
  code: string,
  message: string,
): NextResponse<ApiErrorResponse> {
  const body = apiErrorResponseSchema.parse({
    error: {
      code,
      message,
    },
  });

  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export function createAuthenticationErrorResponse(): NextResponse<ApiErrorResponse> {
  return createApiErrorResponse(
    401,
    "AUTHENTICATION_REQUIRED",
    "Telegram autentifikatsiyasi bajarilmadi. Mini App’ni qayta oching.",
  );
}

export function logServerError(
  operation: string,
  error: unknown,
): void {
  console.error(
    JSON.stringify({
      level: "error",
      operation,
      errorName: error instanceof Error ? error.name : "UnknownError",
    }),
  );
}
