import type { BotContext } from "../types/bot-context.js";
import { createMainMenuKeyboard } from "../keyboards/main-menu.keyboard.js";
import { createSizeKeyboard } from "../keyboards/product-options.keyboard.js";
import { logger } from "../config/logger.js";
import { findActiveProductById } from "../services/product.service.js";
import { formatProductCaption } from "../services/product-presentation.service.js";

export async function showProduct(
  ctx: BotContext,
  productIdInput: unknown,
): Promise<void> {
  try {
    const product = await findActiveProductById(productIdInput);

    if (!product) {
      ctx.session.productSelection = null;
      ctx.session.orderDraft = null;
      await ctx.reply(
        "Afsuski, mahsulot topilmadi yoki hozir sotuvda mavjud emas.",
        {
          reply_markup: createMainMenuKeyboard(),
        },
      );
      return;
    }

    ctx.session.productSelection = {
      productId: product.id,
    };
    ctx.session.orderDraft = null;

    const caption = formatProductCaption(product);
    const keyboard = createSizeKeyboard(product);
    const primaryImage = product.images[0];

    if (!primaryImage) {
      await ctx.reply(`🖼 Mahsulot rasmi mavjud emas.\n\n${caption}`, {
        reply_markup: keyboard,
      });
      return;
    }

    try {
      await ctx.replyWithPhoto(primaryImage.url, {
        caption,
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.warn("Telegram mahsulot rasmini yubora olmadi", {
        productId: product.id,
        imageUrl: primaryImage.url,
        error: error instanceof Error ? error.message : error,
      });
      await ctx.reply(`🖼 Mahsulot rasmini yuklab bo‘lmadi.\n\n${caption}`, {
        reply_markup: keyboard,
      });
    }
  } catch (error) {
    logger.error("Mahsulotni ko‘rsatish handlerida xato", error, {
      updateId: ctx.update.update_id,
    });
    await ctx.reply(
      "Mahsulot ma’lumotlarini yuklashda xato yuz berdi. Iltimos, keyinroq qayta urinib ko‘ring.",
      {
        reply_markup: createMainMenuKeyboard(),
      },
    );
  }
}
