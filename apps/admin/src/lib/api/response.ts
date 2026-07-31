import { NextResponse } from "next/server";
import { IdempotencyInProgressError } from "@kids-store/core";
import { ZodError } from "zod";

import { AdminAuthenticationError } from "../auth/request-auth";
import { AdminServiceError } from "../errors/admin-service-error";

export function noStoreJson(
  body: unknown,
  status = 200,
): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export function adminApiError(error: unknown): NextResponse {
  if (error instanceof IdempotencyInProgressError) {
    return noStoreJson(
      {
        error: {
          code: "IDEMPOTENCY_IN_PROGRESS",
          message: "Amal bajarilmoqda. Bir ozdan keyin natijani tekshiring.",
        },
      },
      409,
    );
  }

  if (
    error instanceof Error &&
    error.message === "RATE_LIMIT_EXCEEDED"
  ) {
    return noStoreJson(
      {
        error: {
          code: "RATE_LIMITED",
          message: "Juda ko‘p so‘rov. Birozdan keyin qayta urinib ko‘ring.",
        },
      },
      429,
    );
  }

  if (error instanceof AdminAuthenticationError) {
    return noStoreJson(
      {
        error: {
          code: error.status === 401 ? "UNAUTHORIZED" : "FORBIDDEN",
          message: error.message,
        },
      },
      error.status,
    );
  }

  if (error instanceof ZodError) {
    return noStoreJson(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Kiritilgan ma’lumotlarni tekshiring.",
          fields: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
      },
      400,
    );
  }

  if (error instanceof SyntaxError) {
    return noStoreJson(
      {
        error: {
          code: "INVALID_JSON",
          message: "So‘rov JSON formati noto‘g‘ri.",
        },
      },
      400,
    );
  }

  if (error instanceof AdminServiceError) {
    return noStoreJson(
      {
        error: {
          code: error.code,
          message: error.message,
        },
      },
      error.status,
    );
  }

  console.error(
    JSON.stringify({
      event: "admin_api_error",
      errorName: error instanceof Error ? error.name : "UnknownError",
    }),
  );

  return noStoreJson(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "Amalni bajarib bo‘lmadi. Keyinroq qayta urinib ko‘ring.",
      },
    },
    500,
  );
}
