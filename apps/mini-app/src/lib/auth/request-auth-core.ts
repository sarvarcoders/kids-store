import {
  verifiedTelegramUserDtoSchema,
  type VerifiedTelegramUserDto,
} from "@kids-store/shared";

import {
  TelegramInitDataError,
  validateTelegramInitData,
  type TelegramAuthReasonCode,
} from "./telegram-init-data";

export const TELEGRAM_INIT_DATA_HEADER = "x-telegram-init-data";

const GENERIC_AUTHENTICATION_MESSAGE =
  "Telegram autentifikatsiyasi bajarilmadi.";

export interface TelegramAuthLogEntry {
  reasonCode: TelegramAuthReasonCode;
  userJsonParseSucceeded: boolean;
  userSchemaSucceeded: boolean;
  userParameterLength: number;
}

interface AuthenticateTelegramRequestOptions {
  developmentMockEnabled?: boolean;
  log?: (entry: TelegramAuthLogEntry) => void;
  nowSeconds?: number;
}

export class MiniAppAuthenticationError extends Error {
  constructor(cause?: unknown) {
    super(
      GENERIC_AUTHENTICATION_MESSAGE,
      cause === undefined ? undefined : { cause },
    );
    this.name = "MiniAppAuthenticationError";
  }
}

function createDevelopmentMockUser(): VerifiedTelegramUserDto {
  return verifiedTelegramUserDtoSchema.parse({
    id: "1",
    firstName: "Dev foydalanuvchi",
    username: "kids_store_dev",
    languageCode: "uz",
    isPremium: false,
  });
}

function getUserParameterLength(rawInitData: string | null): number {
  if (rawInitData === null || rawInitData.length === 0) {
    return 0;
  }

  return new URLSearchParams(rawInitData).get("user")?.length ?? 0;
}

function writeTelegramAuthLog(entry: TelegramAuthLogEntry): void {
  console.info(JSON.stringify(entry));
}

export function authenticateTelegramRequest(
  request: Request,
  botToken: string | undefined,
  options: AuthenticateTelegramRequestOptions = {},
): VerifiedTelegramUserDto {
  const rawInitData = request.headers.get(TELEGRAM_INIT_DATA_HEADER);
  const log = options.log ?? writeTelegramAuthLog;
  let reasonCode: TelegramAuthReasonCode = "invalid_user_schema";
  let userJsonParseSucceeded = false;
  let userSchemaSucceeded = false;
  let userParameterLength = getUserParameterLength(rawInitData);

  try {
    if (rawInitData === null) {
      if (options.developmentMockEnabled) {
        reasonCode = "valid";
        return createDevelopmentMockUser();
      }

      reasonCode = "missing_header";
      throw new MiniAppAuthenticationError();
    }

    if (rawInitData.length === 0) {
      if (options.developmentMockEnabled) {
        reasonCode = "valid";
        return createDevelopmentMockUser();
      }

      reasonCode = "empty_init_data";
      throw new MiniAppAuthenticationError();
    }

    const validated = validateTelegramInitData(
      rawInitData,
      botToken,
      options.nowSeconds === undefined
        ? {}
        : { nowSeconds: options.nowSeconds },
    );
    const user = validated.user;
    userJsonParseSucceeded =
      validated.userValidationDiagnostics.userJsonParseSucceeded;
    userSchemaSucceeded =
      validated.userValidationDiagnostics.userSchemaSucceeded;
    userParameterLength =
      validated.userValidationDiagnostics.userParameterLength;
    const normalizeOptionalText = (
      value: string | undefined,
    ): string | undefined => {
      const normalized = value?.trim();
      return normalized && normalized.length > 0
        ? normalized
        : undefined;
    };
    const lastName = normalizeOptionalText(user.last_name);
    const username = normalizeOptionalText(user.username);
    const languageCode = normalizeOptionalText(user.language_code);
    const verifiedUser = verifiedTelegramUserDtoSchema.parse({
      id: String(user.id),
      firstName: user.first_name.trim(),
      ...(lastName === undefined ? {} : { lastName }),
      ...(username === undefined ? {} : { username }),
      ...(languageCode === undefined ? {} : { languageCode }),
      ...(user.is_premium === undefined
        ? {}
        : { isPremium: user.is_premium }),
      ...(user.photo_url === undefined
        ? {}
        : { photoUrl: user.photo_url }),
    });

    reasonCode = "valid";
    return verifiedUser;
  } catch (error) {
    if (error instanceof TelegramInitDataError) {
      reasonCode = error.reasonCode;
      if (error.userValidationDiagnostics) {
        userJsonParseSucceeded =
          error.userValidationDiagnostics.userJsonParseSucceeded;
        userSchemaSucceeded =
          error.userValidationDiagnostics.userSchemaSucceeded;
        userParameterLength =
          error.userValidationDiagnostics.userParameterLength;
      }
    }

    if (error instanceof MiniAppAuthenticationError) {
      throw error;
    }

    throw new MiniAppAuthenticationError(error);
  } finally {
    log({
      reasonCode,
      userJsonParseSucceeded,
      userSchemaSucceeded,
      userParameterLength,
    });
  }
}
