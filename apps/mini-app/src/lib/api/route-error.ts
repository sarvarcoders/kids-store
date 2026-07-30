import { z } from "zod";

import {
  createApiErrorResponse,
  createAuthenticationErrorResponse,
  logServerError,
} from "./response";
import { MiniAppAuthenticationError } from "../auth/request-auth";
import { CartServiceError } from "../cart/cart.service";
import { CheckoutServiceError } from "../checkout/checkout.service";

export class InvalidJsonBodyError extends Error {
  constructor(cause?: unknown) {
    super(
      "So‘rov JSON formati noto‘g‘ri.",
      cause === undefined ? undefined : { cause },
    );
    this.name = "InvalidJsonBodyError";
  }
}

export async function parseJsonBody(
  request: Request,
): Promise<unknown> {
  try {
    return (await request.json()) as unknown;
  } catch (error) {
    throw new InvalidJsonBodyError(error);
  }
}

export function handleMiniAppApiError(
  error: unknown,
  operation: string,
) {
  if (error instanceof MiniAppAuthenticationError) {
    return createAuthenticationErrorResponse();
  }

  if (
    error instanceof InvalidJsonBodyError ||
    error instanceof z.ZodError
  ) {
    return createApiErrorResponse(
      422,
      "VALIDATION_FAILED",
      "Yuborilgan ma’lumotlar noto‘g‘ri.",
    );
  }

  if (error instanceof CartServiceError) {
    if (error.code === "CART_ITEM_NOT_FOUND") {
      return createApiErrorResponse(
        404,
        error.code,
        error.message,
      );
    }

    if (error.code === "RATE_LIMITED") {
      return createApiErrorResponse(
        429,
        error.code,
        error.message,
      );
    }

    return createApiErrorResponse(409, error.code, error.message);
  }

  if (error instanceof CheckoutServiceError) {
    return createApiErrorResponse(409, error.code, error.message);
  }

  logServerError(operation, error);
  return createApiErrorResponse(
    500,
    "INTERNAL_ERROR",
    "So‘rovni bajarib bo‘lmadi. Keyinroq qayta urinib ko‘ring.",
  );
}
