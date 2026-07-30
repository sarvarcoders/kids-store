import type { Bot } from "grammy";

import {
  adminLauncherOptionsSchema,
  isAdminTelegramUser,
  type AdminLauncherOptions,
} from "../config/admin-launcher.js";
import { logger } from "../config/logger.js";
import { createAdminLauncherKeyboard } from "../keyboards/admin-launcher.keyboard.js";
import type { BotContext } from "../types/bot-context.js";

export const ADMIN_ACCESS_DENIED_MESSAGE = "Bu bo‘lim siz uchun mavjud emas";
export const ADMIN_LAUNCHER_MESSAGE =
  "Admin panelni ochish uchun quyidagi tugmani bosing.";

export function registerAdminHandler(
  bot: Bot<BotContext>,
  options: AdminLauncherOptions,
): void {
  const validatedOptions = adminLauncherOptionsSchema.parse(options);

  bot.command("admin", async (ctx) => {
    if (
      !isAdminTelegramUser(
        ctx.from?.id,
        validatedOptions.allowedAdminIds,
      )
    ) {
      logger.warn("Ruxsatsiz /admin urinishi rad etildi", {
        updateId: ctx.update.update_id,
      });
      await ctx.reply(ADMIN_ACCESS_DENIED_MESSAGE);
      return;
    }

    await ctx.reply(ADMIN_LAUNCHER_MESSAGE, {
      reply_markup: createAdminLauncherKeyboard(
        validatedOptions.adminAppUrl,
      ),
    });
  });
}
