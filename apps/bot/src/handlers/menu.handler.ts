import type { BotContext } from "../types/bot-context.js";
import { createMainMenuKeyboard } from "../keyboards/main-menu.keyboard.js";

export async function showMainMenu(ctx: BotContext): Promise<void> {
  ctx.session.productSelection = null;

  await ctx.reply(
    "Bolalar kiyimlari do‘koniga xush kelibsiz!\n\nKerakli bo‘limni tanlang:",
    {
      reply_markup: createMainMenuKeyboard(),
    },
  );
}

export async function showCatalogHelp(ctx: BotContext): Promise<void> {
  await ctx.reply(
    "Mahsulotni ko‘rish uchun Telegram kanalidagi mahsulot havolasini oching.",
    {
      reply_markup: createMainMenuKeyboard(),
    },
  );
}

export async function showHelp(ctx: BotContext): Promise<void> {
  await ctx.reply(
    "Yordam kerak bo‘lsa, mahsulot havolasini qayta oching yoki /start komandasini yuboring.",
    {
      reply_markup: createMainMenuKeyboard(),
    },
  );
}
