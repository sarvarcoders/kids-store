import {
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

import { adminSessionSecretSchema } from "@kids-store/shared";
import { z } from "zod";

export const ADMIN_SESSION_COOKIE = "kids_store_admin_session";
export const ADMIN_CSRF_HEADER = "x-admin-csrf-token";
export const ADMIN_IDEMPOTENCY_HEADER = "x-idempotency-key";
export const ADMIN_SESSION_TTL_SECONDS = 30 * 60;

const adminSessionPayloadSchema = z.object({
  adminTelegramId: z.string().regex(/^[1-9]\d*$/),
  csrfToken: z.string().min(32).max(128),
  expiresAt: z.number().int().positive(),
  firstName: z.string().trim().min(1).max(120),
  issuedAt: z.number().int().positive(),
  username: z.string().trim().min(1).max(64).optional(),
});

export type AdminSession = z.infer<typeof adminSessionPayloadSchema>;

export interface AdminIdentity {
  adminTelegramId: string;
  firstName: string;
  username?: string;
}

function signPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");
}

export function createAdminSessionToken(
  identityInput: unknown,
  secretInput: unknown,
  nowSeconds = Math.floor(Date.now() / 1_000),
): { session: AdminSession; token: string } {
  const secret = adminSessionSecretSchema.parse(secretInput);
  const identity = z
    .object({
      adminTelegramId: z.string().regex(/^[1-9]\d*$/),
      firstName: z.string().trim().min(1).max(120),
      username: z.string().trim().min(1).max(64).optional(),
    })
    .parse(identityInput);
  const session = adminSessionPayloadSchema.parse({
    ...identity,
    csrfToken: randomBytes(32).toString("base64url"),
    issuedAt: nowSeconds,
    expiresAt: nowSeconds + ADMIN_SESSION_TTL_SECONDS,
  });
  const encodedPayload = Buffer.from(
    JSON.stringify(session),
    "utf8",
  ).toString("base64url");

  return {
    session,
    token: `${encodedPayload}.${signPayload(encodedPayload, secret)}`,
  };
}

export function verifyAdminSessionToken(
  tokenInput: unknown,
  secretInput: unknown,
  nowSeconds = Math.floor(Date.now() / 1_000),
): AdminSession | null {
  const token = z.string().max(2_048).safeParse(tokenInput);
  const secret = adminSessionSecretSchema.safeParse(secretInput);

  if (!token.success || !secret.success) {
    return null;
  }

  const [encodedPayload, receivedSignature, ...extra] =
    token.data.split(".");

  if (
    !encodedPayload ||
    !receivedSignature ||
    extra.length > 0
  ) {
    return null;
  }

  const expectedSignature = signPayload(
    encodedPayload,
    secret.data,
  );
  const receivedBuffer = Buffer.from(receivedSignature, "utf8");
  const expectedBuffer = Buffer.from(expectedSignature, "utf8");

  if (
    receivedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(receivedBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const payload: unknown = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    );
    const session = adminSessionPayloadSchema.parse(payload);

    return session.expiresAt > nowSeconds ? session : null;
  } catch {
    return null;
  }
}

export function isAdminAllowed(
  telegramUserIdInput: unknown,
  allowedIdsInput: unknown,
): boolean {
  const telegramUserId = z
    .string()
    .regex(/^[1-9]\d*$/)
    .safeParse(telegramUserIdInput);
  const allowedIds = z
    .array(z.string().regex(/^[1-9]\d*$/))
    .safeParse(allowedIdsInput);

  return (
    telegramUserId.success &&
    allowedIds.success &&
    new Set(allowedIds.data).has(telegramUserId.data)
  );
}

export function verifyCsrfToken(
  sessionTokenInput: unknown,
  requestTokenInput: unknown,
): boolean {
  const sessionToken = z
    .string()
    .min(32)
    .max(128)
    .safeParse(sessionTokenInput);
  const requestToken = z
    .string()
    .min(32)
    .max(128)
    .safeParse(requestTokenInput);

  if (!sessionToken.success || !requestToken.success) {
    return false;
  }

  const first = Buffer.from(sessionToken.data, "utf8");
  const second = Buffer.from(requestToken.data, "utf8");

  return (
    first.length === second.length &&
    timingSafeEqual(first, second)
  );
}
