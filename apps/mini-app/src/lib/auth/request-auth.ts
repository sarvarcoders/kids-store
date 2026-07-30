import "server-only";

import {
  verifiedTelegramUserDtoSchema,
  type VerifiedTelegramUserDto,
} from "@kids-store/shared";

import {
  isMiniAppDevelopmentMockEnabled,
  serverEnv,
} from "../env/server";
import {
  TelegramInitDataError,
  validateTelegramInitData,
} from "./telegram-init-data";

export const TELEGRAM_INIT_DATA_HEADER = "x-telegram-init-data";

export class MiniAppAuthenticationError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
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

export function authenticateMiniAppRequest(
  request: Request,
): VerifiedTelegramUserDto {
  const rawInitData = request.headers
    .get(TELEGRAM_INIT_DATA_HEADER)
    ?.trim();

  if (!rawInitData) {
    if (isMiniAppDevelopmentMockEnabled()) {
      return createDevelopmentMockUser();
    }

    throw new MiniAppAuthenticationError(
      "Telegram orqali autentifikatsiya talab qilinadi.",
    );
  }

  try {
    const validated = validateTelegramInitData(
      rawInitData,
      serverEnv.TELEGRAM_BOT_TOKEN,
    );
    const user = validated.user;

    return verifiedTelegramUserDtoSchema.parse({
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
  } catch (error) {
    const message =
      error instanceof TelegramInitDataError
        ? error.message
        : "Telegram autentifikatsiyasi bajarilmadi.";

    throw new MiniAppAuthenticationError(message, error);
  }
}
