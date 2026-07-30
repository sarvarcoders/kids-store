import { createHmac, timingSafeEqual } from "node:crypto";

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
const botTokenSchema = z
  .string()
  .min(1)
  .refine((value) => value === value.trim());
const optionsSchema = z.object({
  maxAgeSeconds: z.number().int().positive().max(86_400),
  nowSeconds: z.number().int().positive(),
});

export type TelegramAuthReasonCode =
  | "valid"
  | "missing_header"
  | "empty_init_data"
  | "duplicate_parameter"
  | "missing_hash"
  | "invalid_hash"
  | "missing_auth_date"
  | "expired_auth_date"
  | "future_auth_date"
  | "missing_user"
  | "invalid_user_json"
  | "invalid_user_schema";

export type TelegramInitDataFailureReasonCode = Exclude<
  TelegramAuthReasonCode,
  "valid" | "missing_header"
>;

export interface TelegramUserValidationDiagnostics {
  userJsonParseSucceeded: boolean;
  userSchemaSucceeded: boolean;
  userParameterLength: number;
}

export class TelegramInitDataError extends Error {
  readonly reasonCode: TelegramInitDataFailureReasonCode;
  readonly userValidationDiagnostics:
    | TelegramUserValidationDiagnostics
    | undefined;

  constructor(
    reasonCode: TelegramInitDataFailureReasonCode,
    cause?: unknown,
    userValidationDiagnostics?: TelegramUserValidationDiagnostics,
  ) {
    super(
      "Telegram autentifikatsiyasi tasdiqlanmadi.",
      cause === undefined ? undefined : { cause },
    );
    this.name = "TelegramInitDataError";
    this.reasonCode = reasonCode;
    this.userValidationDiagnostics = userValidationDiagnostics;
  }
}

export interface ValidatedTelegramInitData {
  authDate: Date;
  queryId: string | null;
  user: TelegramWebAppUser;
  userValidationDiagnostics: TelegramUserValidationDiagnostics;
}

function parseUniqueParams(rawInitData: string): URLSearchParams {
  if (rawInitData.length === 0) {
    throw new TelegramInitDataError("empty_init_data");
  }

  if (rawInitData.length > MAX_INIT_DATA_LENGTH) {
    throw new TelegramInitDataError("invalid_hash");
  }

  const params = new URLSearchParams(rawInitData);
  const seenKeys = new Set<string>();

  for (const [key] of params) {
    if (seenKeys.has(key)) {
      throw new TelegramInitDataError("duplicate_parameter");
    }

    seenKeys.add(key);
  }

  return params;
}

function verifyHash(params: URLSearchParams, botToken: string): void {
  const receivedHash = params.get("hash");

  if (receivedHash === null) {
    throw new TelegramInitDataError("missing_hash");
  }

  const parsedHash = hashSchema.safeParse(receivedHash);
  const parsedBotToken = botTokenSchema.safeParse(botToken);

  if (!parsedHash.success || !parsedBotToken.success) {
    throw new TelegramInitDataError("invalid_hash");
  }

  const dataCheckString = Array.from(params.entries())
    .filter(([key]) => key !== "hash")
    .sort(([firstKey], [secondKey]) =>
      firstKey < secondKey ? -1 : firstKey > secondKey ? 1 : 0,
    )
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secretKey = createHmac("sha256", "WebAppData")
    .update(parsedBotToken.data)
    .digest();
  const expectedHash = createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest();
  const receivedHashBuffer = Buffer.from(parsedHash.data, "hex");

  if (
    receivedHashBuffer.length !== expectedHash.length ||
    !timingSafeEqual(receivedHashBuffer, expectedHash)
  ) {
    throw new TelegramInitDataError("invalid_hash");
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
  const parsedRawInitData = z.string().safeParse(rawInitDataInput);
  const parsedBotToken = botTokenSchema.safeParse(botTokenInput);

  if (!parsedRawInitData.success) {
    throw new TelegramInitDataError("empty_init_data");
  }

  if (!parsedBotToken.success) {
    throw new TelegramInitDataError("invalid_hash");
  }

  const rawInitData = parsedRawInitData.data;
  const botToken = parsedBotToken.data;
  const options = optionsSchema.parse({
    maxAgeSeconds:
      optionsInput.maxAgeSeconds ?? DEFAULT_INIT_DATA_MAX_AGE_SECONDS,
    nowSeconds: optionsInput.nowSeconds ?? Math.floor(Date.now() / 1_000),
  });
  const params = parseUniqueParams(rawInitData);

  verifyHash(params, botToken);

  const rawAuthDate = params.get("auth_date");

  if (rawAuthDate === null) {
    throw new TelegramInitDataError("missing_auth_date");
  }

  const parsedAuthDate = authDateSchema.safeParse(rawAuthDate);

  if (!parsedAuthDate.success) {
    throw new TelegramInitDataError("missing_auth_date");
  }

  const ageSeconds = options.nowSeconds - parsedAuthDate.data;

  if (ageSeconds > options.maxAgeSeconds) {
    throw new TelegramInitDataError("expired_auth_date");
  }

  if (ageSeconds < -FUTURE_AUTH_DATE_TOLERANCE_SECONDS) {
    throw new TelegramInitDataError("future_auth_date");
  }

  const rawUser = params.get("user");

  if (rawUser === null) {
    throw new TelegramInitDataError("missing_user");
  }

  let parsedUserJson: unknown;

  try {
    parsedUserJson = JSON.parse(rawUser) as unknown;
  } catch (error) {
    throw new TelegramInitDataError("invalid_user_json", error, {
      userJsonParseSucceeded: false,
      userSchemaSucceeded: false,
      userParameterLength: rawUser.length,
    });
  }

  const parsedUser = telegramWebAppUserSchema.safeParse(parsedUserJson);

  if (!parsedUser.success) {
    throw new TelegramInitDataError(
      "invalid_user_schema",
      parsedUser.error,
      {
        userJsonParseSucceeded: true,
        userSchemaSucceeded: false,
        userParameterLength: rawUser.length,
      },
    );
  }

  const diagnostics = {
    userJsonParseSucceeded: true,
    userSchemaSucceeded: true,
    userParameterLength: rawUser.length,
  } satisfies TelegramUserValidationDiagnostics;

  return {
    authDate: new Date(parsedAuthDate.data * 1_000),
    queryId: params.get("query_id"),
    user: parsedUser.data,
    userValidationDiagnostics: diagnostics,
  };
}
