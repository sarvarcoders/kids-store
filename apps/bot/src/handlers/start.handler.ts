import type { Bot } from "grammy";
import { z } from "zod";

import type { BotContext } from "../types/bot-context.js";
import { databaseIdSchema } from "../config/validation.js";
import { createMainMenuKeyboard } from "../keyboards/main-menu.keyboard.js";
import { showMainMenu } from "./menu.handler.js";
import { showProduct } from "./product.handler.js";

const productStartPayloadSchema = z
  .string()
  .regex(/^product_[1-9]\d*$/)
  .transform((payload) => databaseIdSchema.parse(payload.slice("product_".length)));

export function registerStartHandler(bot: Bot<BotContext>): void {
  bot.command("start", async (ctx) => {
    const payload = typeof ctx.match === "string" ? ctx.match.trim() : "";

    if (payload.length === 0) {
      await showMainMenu(ctx);
      return;
    }

    const parsedPayload = productStartPayloadSchema.safeParse(payload);

    if (!parsedPayload.success) {
      await ctx.reply(
        "Mahsulot havolasi noto‘g‘ri. Iltimos, Telegram kanalidagi havoladan foydalaning.",
        {
          reply_markup: createMainMenuKeyboard(),
        },
      );
      return;
    }

    await showProduct(ctx, parsedPayload.data);
  });
}
