import {
  apiErrorResponseSchema,
  type ApiErrorResponse,
} from "@kids-store/shared";
import { NextResponse } from "next/server";

import { MiniAppAuthenticationError } from "../auth/request-auth";

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

  return NextResponse.json(body, { status });
}

export function createAuthenticationErrorResponse(
  error: unknown,
): NextResponse<ApiErrorResponse> {
  const message =
    error instanceof MiniAppAuthenticationError
      ? error.message
      : "Telegram autentifikatsiyasi bajarilmadi.";

  return createApiErrorResponse(401, "AUTHENTICATION_REQUIRED", message);
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
