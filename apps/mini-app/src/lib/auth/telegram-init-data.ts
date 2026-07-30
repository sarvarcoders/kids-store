import {
  createHmac,
  timingSafeEqual,
} from "node:crypto";

import {
  telegramWebAppUserSchema,
  type TelegramWebAppUser,
} from "@kids-store/shared";
import { z } from "zod";

export const DEFAULT_INIT_DATA_MAX_AGE_SECONDS = 60 * 60;

const MAX_INIT_DATA_LENGTH = 16_384;
const FUTURE_AUTH_DATE_TOLERANCE_SECONDS = 30;
const authDateSchema = z.coerce.number().int().positive();
const hashSchema = z.string().regex(/^[a-f0-9]{64}$/i);
const optionsSchema = z.object({
  maxAgeSeconds: z.number().int().positive().max(86_400),
  nowSeconds: z.number().int().positive(),
});

export type TelegramInitDataErrorCode =
  | "MALFORMED_INIT_DATA"
  | "INVALID_HASH"
  | "EXPIRED_AUTH_DATE"
  | "MISSING_USER";

const authErrorMessages: Record<TelegramInitDataErrorCode, string> = {
  MALFORMED_INIT_DATA: "Telegram autentifikatsiya ma’lumoti noto‘g‘ri.",
  INVALID_HASH: "Telegram autentifikatsiyasi tasdiqlanmadi.",
  EXPIRED_AUTH_DATE: "Telegram sessiyasi eskirgan. Mini App’ni qayta oching.",
  MISSING_USER: "Telegram foydalanuvchi ma’lumoti topilmadi.",
};

export class TelegramInitDataError extends Error {
  readonly code: TelegramInitDataErrorCode;

  constructor(code: TelegramInitDataErrorCode, cause?: unknown) {
    super(
      authErrorMessages[code],
      cause === undefined ? undefined : { cause },
    );
    this.name = "TelegramInitDataError";
    this.code = code;
  }
}

export interface ValidatedTelegramInitData {
  authDate: Date;
  queryId: string | null;
  user: TelegramWebAppUser;
}

function parseUniqueParams(rawInitData: string): URLSearchParams {
  if (
    rawInitData.length === 0 ||
    rawInitData.length > MAX_INIT_DATA_LENGTH
  ) {
    throw new TelegramInitDataError("MALFORMED_INIT_DATA");
  }

  const params = new URLSearchParams(rawInitData);
  const seenKeys = new Set<string>();

  for (const [key] of params) {
    if (seenKeys.has(key)) {
      throw new TelegramInitDataError("MALFORMED_INIT_DATA");
    }

    seenKeys.add(key);
  }

  return params;
}

function verifyHash(
  params: URLSearchParams,
  botToken: string,
): void {
  const receivedHash = params.get("hash");
  const parsedHash = hashSchema.safeParse(receivedHash);

  if (!parsedHash.success || botToken.trim().length === 0) {
    throw new TelegramInitDataError("INVALID_HASH");
  }

  const dataCheckString = Array.from(params.entries())
    .filter(([key]) => key !== "hash")
    .sort(([firstKey], [secondKey]) =>
      firstKey < secondKey ? -1 : firstKey > secondKey ? 1 : 0,
    )
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secretKey = createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();
  const expectedHash = createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest();
  const receivedHashBuffer = Buffer.from(parsedHash.data, "hex");

  if (
    receivedHashBuffer.length !== expectedHash.length ||
    !timingSafeEqual(receivedHashBuffer, expectedHash)
  ) {
    throw new TelegramInitDataError("INVALID_HASH");
  }
}

export function validateTelegramInitData(
  rawInitDataInput: unknown,
  botTokenInput: unknown,
  optionsInput: {
    maxAgeSeconds?: number;
    nowSeconds?: number;
  } = {},
): ValidatedTelegramInitData {
  const rawInitData = z.string().parse(rawInitDataInput);
  const botToken = z.string().min(1).parse(botTokenInput);
  const options = optionsSchema.parse({
    maxAgeSeconds:
      optionsInput.maxAgeSeconds ?? DEFAULT_INIT_DATA_MAX_AGE_SECONDS,
    nowSeconds: optionsInput.nowSeconds ?? Math.floor(Date.now() / 1_000),
  });
  const params = parseUniqueParams(rawInitData);

  verifyHash(params, botToken);

  const parsedAuthDate = authDateSchema.safeParse(params.get("auth_date"));

  if (!parsedAuthDate.success) {
    throw new TelegramInitDataError("MALFORMED_INIT_DATA");
  }

  const ageSeconds = options.nowSeconds - parsedAuthDate.data;

  if (
    ageSeconds > options.maxAgeSeconds ||
    ageSeconds < -FUTURE_AUTH_DATE_TOLERANCE_SECONDS
  ) {
    throw new TelegramInitDataError("EXPIRED_AUTH_DATE");
  }

  const rawUser = params.get("user");

  if (!rawUser) {
    throw new TelegramInitDataError("MISSING_USER");
  }

  try {
    const user = telegramWebAppUserSchema.parse(JSON.parse(rawUser));

    return {
      authDate: new Date(parsedAuthDate.data * 1_000),
      queryId: params.get("query_id"),
      user,
    };
  } catch (error) {
    throw new TelegramInitDataError("MISSING_USER", error);
  }
}
