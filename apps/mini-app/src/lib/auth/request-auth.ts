import "server-only";

import type { VerifiedTelegramUserDto } from "@kids-store/shared";

import {
  isMiniAppDevelopmentMockEnabled,
  serverEnv,
} from "../env/server";
import {
  authenticateTelegramRequest,
} from "./request-auth-core";

export function authenticateMiniAppRequest(
  request: Request,
): VerifiedTelegramUserDto {
  return authenticateTelegramRequest(
    request,
    serverEnv.TELEGRAM_BOT_TOKEN,
    {
      developmentMockEnabled: isMiniAppDevelopmentMockEnabled(),
    },
  );
}

export {
  MiniAppAuthenticationError,
  TELEGRAM_INIT_DATA_HEADER,
} from "./request-auth-core";
