import { ResilientRateLimiter } from "@kids-store/core";
import type { Bot } from "grammy";
import { z } from "zod";

import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import {
  botRedisConfig,
  getBotRedisProducer,
  logRedisFallback,
} from "../config/redis.js";
import { databaseIdSchema } from "../config/validation.js";
import { isAdminTelegramUser } from "../config/admin-launcher.js";
import {
  ChannelPostServiceError,
  type ChannelPostService,
} from "../services/channel-post.service.js";
import type { BotContext } from "../types/bot-context.js";

const publishProductIdSchema = z
  .string()
  .trim()
  .regex(/^[1-9]\d*$/)
  .transform((value) => databaseIdSchema.parse(value));
const publishRateLimiter = new ResilientRateLimiter({
  keyPrefix: botRedisConfig?.keyPrefix ?? "kids-store",
  limit: 5,
  onRedisError: logRedisFallback,
  redis: getBotRedisProducer() ?? null,
  scope: "bot-publish",
  windowMs: 60_000,
});

function isAdmin(ctx: BotContext): boolean {
  return isAdminTelegramUser(ctx.from?.id, env.ADMIN_TELEGRAM_IDS);
}

function getPublishErrorMessage(error: unknown): string {
  if (
    error instanceof ChannelPostServiceError &&
    error.code === "PRODUCT_NOT_AVAILABLE"
  ) {
    return "Mahsulot topilmadi yoki hozir faol emas.";
  }

  return "Mahsulotni kanalga chiqarishda xato yuz berdi. Keyinroq qayta urinib ko‘ring.";
}

export function registerPublishHandler(
  bot: Bot<BotContext>,
  channelPostService: ChannelPostService,
): void {
  bot.command("publish", async (ctx) => {
    const telegramUserId = ctx.from?.id;

    if (telegramUserId === undefined || !isAdmin(ctx)) {
      logger.warn("Ruxsatsiz /publish urinishi rad etildi", {
        updateId: ctx.update.update_id,
      });
      await ctx.reply("Bu buyruqni bajarishga ruxsat yo‘q.");
      return;
    }

    if (!(await publishRateLimiter.consume(String(telegramUserId))).allowed) {
      await ctx.reply(
        "Juda ko‘p publish so‘rovi yuborildi. Bir oz kutib qayta urinib ko‘ring.",
      );
      return;
    }

    const commandArgument =
      typeof ctx.match === "string" ? ctx.match.trim() : "";
    const parsedProductId = publishProductIdSchema.safeParse(commandArgument);

    if (!parsedProductId.success) {
      await ctx.reply(
        "Product ID noto‘g‘ri. Foydalanish: /publish <productId>",
      );
      return;
    }

    try {
      const publishedPost = await channelPostService.publishProduct(
        parsedProductId.data,
      );
      const responseLines = [
        "✅ Mahsulot kanalga muvaffaqiyatli chiqarildi.",
        `Mahsulot: ${publishedPost.productName}`,
        `Kanal message ID: ${String(publishedPost.telegramMessageId)}`,
      ];

      if (publishedPost.postUrl) {
        responseLines.push(`Kanal posti: ${publishedPost.postUrl}`);
      }

      await ctx.reply(responseLines.join("\n"));
    } catch (error) {
      logger.error("/publish handlerida xato", error, {
        productId: parsedProductId.data,
        updateId: ctx.update.update_id,
      });
      await ctx.reply(getPublishErrorMessage(error));
    }
  });
}
