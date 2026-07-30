import "server-only";

import { adminIdempotencyKeySchema } from "@kids-store/shared";

import { getAdminServerEnv } from "../env/server";
import {
  ADMIN_CSRF_HEADER,
  ADMIN_IDEMPOTENCY_HEADER,
  ADMIN_SESSION_COOKIE,
  verifyAdminSessionToken,
  verifyCsrfToken,
  type AdminSession,
} from "./session-core";

export class AdminAuthenticationError extends Error {
  readonly status: 401 | 403 | 429;

  constructor(status: 401 | 403 | 429, message: string) {
    super(message);
    this.name = "AdminAuthenticationError";
    this.status = status;
  }
}

function readCookie(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) {
    return null;
  }

  for (const part of cookieHeader.split(";")) {
    const [key, ...valueParts] = part.trim().split("=");

    if (key === name) {
      return valueParts.join("=") || null;
    }
  }

  return null;
}

export function authenticateAdminRequest(
  request: Request,
  options: {
    csrf?: boolean;
    idempotency?: boolean;
  } = {},
): {
  idempotencyKey?: string;
  session: AdminSession;
} {
  const env = getAdminServerEnv();
  const token = readCookie(
    request.headers.get("cookie"),
    ADMIN_SESSION_COOKIE,
  );
  const session = verifyAdminSessionToken(
    token,
    env.ADMIN_SESSION_SECRET,
  );

  if (!session) {
    throw new AdminAuthenticationError(
      401,
      "Admin sessiyasi mavjud emas yoki eskirgan.",
    );
  }

  if (
    options.csrf &&
    !verifyCsrfToken(
      session.csrfToken,
      request.headers.get(ADMIN_CSRF_HEADER),
    )
  ) {
    throw new AdminAuthenticationError(
      403,
      "Xavfsizlik tokeni tasdiqlanmadi.",
    );
  }

  const idempotencyKey = options.idempotency
    ? adminIdempotencyKeySchema.safeParse(
        request.headers.get(ADMIN_IDEMPOTENCY_HEADER),
      )
    : null;

  if (idempotencyKey && !idempotencyKey.success) {
    throw new AdminAuthenticationError(
      403,
      "Mutation identifikatori tasdiqlanmadi.",
    );
  }

  return {
    session,
    ...(idempotencyKey?.success
      ? { idempotencyKey: idempotencyKey.data }
      : {}),
  };
}
