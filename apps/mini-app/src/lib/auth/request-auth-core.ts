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
  event: "telegram_auth";
  path: string;
  reasonCode: TelegramAuthReasonCode;
  headerPresent: boolean;
  initDataLength: number;
  hashPresent: boolean;
  authDatePresent: boolean;
  userParameterPresent: boolean;
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
    isDevelopmentMock: true,
  });
}

function inspectInitData(
  request: Request,
  rawInitData: string | null,
): Omit<TelegramAuthLogEntry, "event" | "reasonCode"> {
  const params =
    rawInitData === null || rawInitData.length === 0
      ? null
      : new URLSearchParams(rawInitData);

  return {
    path: new URL(request.url).pathname,
    headerPresent: rawInitData !== null,
    initDataLength: rawInitData?.length ?? 0,
    hashPresent: params?.has("hash") ?? false,
    authDatePresent: params?.has("auth_date") ?? false,
    userParameterPresent: params?.has("user") ?? false,
  };
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
  const diagnostics = inspectInitData(request, rawInitData);
  const log = options.log ?? writeTelegramAuthLog;
  let reasonCode: TelegramAuthReasonCode = "invalid_user_json";

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
    const verifiedUser = verifiedTelegramUserDtoSchema.parse({
      id: String(user.id),
      firstName: user.first_name,
      ...(user.last_name === undefined
        ? {}
        : { lastName: user.last_name }),
      ...(user.username === undefined
        ? {}
        : { username: user.username }),
      ...(user.language_code === undefined
        ? {}
        : { languageCode: user.language_code }),
      ...(user.is_premium === undefined
        ? {}
        : { isPremium: user.is_premium }),
      isDevelopmentMock: false,
    });

    reasonCode = "valid";
    return verifiedUser;
  } catch (error) {
    if (error instanceof TelegramInitDataError) {
      reasonCode = error.reasonCode;
    }

    if (error instanceof MiniAppAuthenticationError) {
      throw error;
    }

    throw new MiniAppAuthenticationError(error);
  } finally {
    log({
      event: "telegram_auth",
      path: diagnostics.path,
      reasonCode,
      headerPresent: diagnostics.headerPresent,
      initDataLength: diagnostics.initDataLength,
      hashPresent: diagnostics.hashPresent,
      authDatePresent: diagnostics.authDatePresent,
      userParameterPresent: diagnostics.userParameterPresent,
    });
  }
}
