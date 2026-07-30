import {
  TelegramInitDataError,
  validateTelegramInitData,
} from "@kids-store/core";
import { z } from "zod";

import { isAdminAllowed, type AdminIdentity } from "./session-core";

export class AdminLoginError extends Error {
  readonly code: "FORBIDDEN" | "UNAUTHORIZED";

  constructor(
    code: "FORBIDDEN" | "UNAUTHORIZED",
    cause?: unknown,
  ) {
    super(
      code === "FORBIDDEN"
        ? "Bu Telegram hisobiga admin ruxsati berilmagan."
        : "Telegram autentifikatsiyasi tasdiqlanmadi.",
      cause === undefined ? undefined : { cause },
    );
    this.name = "AdminLoginError";
    this.code = code;
  }
}

export function validateAdminTelegramLogin(input: {
  allowedIds: unknown;
  botToken: unknown;
  initData: unknown;
  nowSeconds?: number;
}): AdminIdentity {
  try {
    const botToken = z.string().parse(input.botToken);
    const validated = validateTelegramInitData(
      input.initData,
      botToken,
      input.nowSeconds === undefined
        ? {}
        : { nowSeconds: input.nowSeconds },
    );
    const telegramUserId = String(validated.user.id);

    if (!isAdminAllowed(telegramUserId, input.allowedIds)) {
      throw new AdminLoginError("FORBIDDEN");
    }

    const username = validated.user.username?.trim();

    return {
      adminTelegramId: telegramUserId,
      firstName: validated.user.first_name.trim(),
      ...(username ? { username } : {}),
    };
  } catch (error) {
    if (error instanceof AdminLoginError) {
      throw error;
    }

    if (error instanceof TelegramInitDataError) {
      throw new AdminLoginError("UNAUTHORIZED", error);
    }

    throw error;
  }
}
