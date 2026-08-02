import type { BotContext } from "../types/bot-context.js";
import { createMainMenuKeyboard } from "../keyboards/main-menu.keyboard.js";
import { createSizeKeyboard } from "../keyboards/product-options.keyboard.js";
import { logger } from "../config/logger.js";
import { botProductPhotoCache } from "../services/bot-product-photo-cache.js";
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

    const cachedFileId = await botProductPhotoCache.get(primaryImage.url);

    try {
      const sentMessage = await ctx.replyWithPhoto(
        cachedFileId ?? primaryImage.url,
        {
          caption,
          reply_markup: keyboard,
        },
      );
      const reusableFileId = sentMessage.photo.at(-1)?.file_id;

      if (!cachedFileId && reusableFileId) {
        void botProductPhotoCache.set(primaryImage.url, reusableFileId);
      }
    } catch (error) {
      if (cachedFileId) {
        await botProductPhotoCache.delete(primaryImage.url);

        try {
          const sentMessage = await ctx.replyWithPhoto(primaryImage.url, {
            caption,
            reply_markup: keyboard,
          });
          const reusableFileId = sentMessage.photo.at(-1)?.file_id;

          if (reusableFileId) {
            void botProductPhotoCache.set(primaryImage.url, reusableFileId);
          }
          return;
        } catch (freshImageError) {
          logger.warn("Telegram mahsulot rasmini URL orqali ham yubora olmadi", {
            productId: product.id,
            error:
              freshImageError instanceof Error
                ? freshImageError.message
                : freshImageError,
          });
        }
      }

      logger.warn("Telegram mahsulot rasmini yubora olmadi", {
        productId: product.id,
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
