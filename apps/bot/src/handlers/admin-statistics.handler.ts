import type { Bot } from "grammy";

import {
  adminLauncherOptionsSchema,
  isAdminTelegramUser,
} from "../config/admin-launcher.js";
import {
  parseAdminStatisticsCallbackData,
  type AdminStatisticsPeriod,
} from "../config/admin-statistics.js";
import { logger } from "../config/logger.js";
import { createAdminStatisticsKeyboard } from "../keyboards/admin-statistics.keyboard.js";
import { formatAdminStatistics } from "../services/admin-statistics.formatter.js";
import type { AdminStatisticsReport } from "../services/admin-statistics.service.js";
import type { BotContext } from "../types/bot-context.js";
import { ADMIN_ACCESS_DENIED_MESSAGE } from "./admin.handler.js";

export const ADMIN_STATISTICS_ERROR_MESSAGE =
  "Statistikani yuklashda xato yuz berdi. Iltimos, keyinroq qayta urinib ko‘ring.";

interface AdminStatisticsHandlerOptions {
  allowedAdminIds: string[];
}

interface AdminStatisticsReader {
  getStatistics(period: unknown): Promise<AdminStatisticsReport>;
}

export function isTelegramMessageNotModified(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.toLocaleLowerCase("en").includes("message is not modified")
  );
}

function isAllowedAdmin(
  ctx: BotContext,
  allowedAdminIds: readonly string[],
): boolean {
  return isAdminTelegramUser(ctx.from?.id, allowedAdminIds);
}

async function loadStatisticsMessage(
  statisticsService: AdminStatisticsReader,
  period: AdminStatisticsPeriod,
): Promise<{
  reply_markup: ReturnType<typeof createAdminStatisticsKeyboard>;
  text: string;
}> {
  const report = await statisticsService.getStatistics(period);

  return {
    reply_markup: createAdminStatisticsKeyboard(period),
    text: formatAdminStatistics(report),
  };
}

export function registerAdminStatisticsHandler(
  bot: Bot<BotContext>,
  statisticsService: AdminStatisticsReader,
  options: AdminStatisticsHandlerOptions,
): void {
  const validatedOptions = adminLauncherOptionsSchema
    .pick({ allowedAdminIds: true })
    .parse(options);

  bot.command("stats", async (ctx) => {
    if (!isAllowedAdmin(ctx, validatedOptions.allowedAdminIds)) {
      logger.warn("Ruxsatsiz /stats urinishi rad etildi", {
        updateId: ctx.update.update_id,
      });
      await ctx.reply(ADMIN_ACCESS_DENIED_MESSAGE);
      return;
    }

    try {
      const message = await loadStatisticsMessage(
        statisticsService,
        "today",
      );
      await ctx.reply(message.text, {
        reply_markup: message.reply_markup,
      });
    } catch (error) {
      logger.error("/stats handlerida xato", error, {
        updateId: ctx.update.update_id,
      });
      await ctx.reply(ADMIN_STATISTICS_ERROR_MESSAGE);
    }
  });

  bot.callbackQuery(/^admin_stats:/, async (ctx) => {
    if (!isAllowedAdmin(ctx, validatedOptions.allowedAdminIds)) {
      logger.warn("Ruxsatsiz statistika callback urinishi rad etildi", {
        updateId: ctx.update.update_id,
      });
      await ctx.answerCallbackQuery({
        show_alert: true,
        text: ADMIN_ACCESS_DENIED_MESSAGE,
      });
      return;
    }

    const parsedPeriod = (() => {
      try {
        return parseAdminStatisticsCallbackData(ctx.callbackQuery.data);
      } catch {
        return null;
      }
    })();

    if (parsedPeriod === null) {
      await ctx.answerCallbackQuery({
        text: "Noto‘g‘ri statistika davri.",
      });
      return;
    }

    await ctx.answerCallbackQuery();

    try {
      const message = await loadStatisticsMessage(
        statisticsService,
        parsedPeriod,
      );
      await ctx.editMessageText(message.text, {
        reply_markup: message.reply_markup,
      });
    } catch (error) {
      if (isTelegramMessageNotModified(error)) {
        return;
      }

      logger.error("Statistika callback handlerida xato", error, {
        period: parsedPeriod,
        updateId: ctx.update.update_id,
      });
      await ctx.reply(ADMIN_STATISTICS_ERROR_MESSAGE);
    }
  });
}
