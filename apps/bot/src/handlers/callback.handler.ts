import type { Bot } from "grammy";
import { z } from "zod";

import type { BotContext } from "../types/bot-context.js";
import { databaseIdSchema } from "../config/validation.js";
import { logger } from "../config/logger.js";
import {
  MENU_CALLBACKS,
  createMainMenuKeyboard,
} from "../keyboards/main-menu.keyboard.js";
import {
  createColorKeyboard,
} from "../keyboards/product-options.keyboard.js";
import { createQuantityKeyboard } from "../keyboards/order.keyboard.js";
import { findActiveProductById } from "../services/product.service.js";
import { showCatalogHelp, showHelp, showMainMenu } from "./menu.handler.js";
import { showProduct } from "./product.handler.js";

const menuCallbackSchema = z.enum([
  MENU_CALLBACKS.main,
  MENU_CALLBACKS.catalog,
  MENU_CALLBACKS.help,
]);

const callbackIdSchema = z
  .string()
  .regex(/^[1-9]\d*$/)
  .transform((value) => databaseIdSchema.parse(value));

const selectionCallbackSchema = z.tuple([
  z.enum(["size", "color"]),
  callbackIdSchema,
  callbackIdSchema,
]);

const productCallbackSchema = z.tuple([
  z.literal("product"),
  callbackIdSchema,
]);

async function answerCallback(ctx: BotContext): Promise<void> {
  try {
    await ctx.answerCallbackQuery();
  } catch (error) {
    logger.warn("Callback query’ga javob berib bo‘lmadi", {
      updateId: ctx.update.update_id,
      error: error instanceof Error ? error.message : error,
    });
  }
}

async function handleMenuCallback(
  ctx: BotContext,
  callback: z.infer<typeof menuCallbackSchema>,
): Promise<void> {
  if (callback === MENU_CALLBACKS.main) {
    await showMainMenu(ctx);
    return;
  }

  if (callback === MENU_CALLBACKS.catalog) {
    await showCatalogHelp(ctx);
    return;
  }

  await showHelp(ctx);
}

async function handleSizeSelection(
  ctx: BotContext,
  productId: number,
  variantId: number,
): Promise<void> {
  const product = await findActiveProductById(productId);
  const variant = product?.variants.find((item) => item.id === variantId);

  if (!product || !variant || variant.stock <= 0) {
    await ctx.reply(
      "Tanlangan o‘lcham hozir mavjud emas. Mahsulotni qayta ochib ko‘ring.",
      {
        reply_markup: createMainMenuKeyboard(),
      },
    );
    return;
  }

  ctx.session.productSelection = {
    productId: product.id,
    selectedSize: variant.size,
  };
  ctx.session.orderDraft = null;

  await ctx.reply(
    `O‘lcham: ${variant.size}\nEndi rangni tanlang:`,
    {
      reply_markup: createColorKeyboard(product, variant.size),
    },
  );
}

async function handleColorSelection(
  ctx: BotContext,
  productId: number,
  variantId: number,
): Promise<void> {
  const product = await findActiveProductById(productId);
  const variant = product?.variants.find((item) => item.id === variantId);

  if (!product || !variant || variant.stock <= 0) {
    await ctx.reply(
      "Tanlangan variant hozir mavjud emas. Mahsulotni qayta ochib ko‘ring.",
      {
        reply_markup: createMainMenuKeyboard(),
      },
    );
    return;
  }

  ctx.session.productSelection = {
    productId: product.id,
    selectedSize: variant.size,
    selectedColor: variant.color,
    productVariantId: variant.id,
  };
  const unitPrice =
    product.discountPrice !== null &&
    product.discountPrice < product.price
      ? product.discountPrice
      : product.price;

  ctx.session.orderDraft = {
    productId: product.id,
    productVariantId: variant.id,
    productName: product.name,
    selectedSize: variant.size,
    selectedColor: variant.color,
    unitPrice,
    availableStock: variant.stock,
    step: "selecting_quantity",
  };

  await ctx.reply(
    `✅ Variant tanlandi:\nO‘lcham: ${variant.size}\nRang: ${variant.color}\nOmborda: ${String(variant.stock)} dona\n\nMiqdorni tanlang:`,
    {
      reply_markup: createQuantityKeyboard(variant.id, variant.stock),
    },
  );
}

export function registerCallbackHandlers(bot: Bot<BotContext>): void {
  bot.on("callback_query:data", async (ctx) => {
    await answerCallback(ctx);

    try {
      const callbackData = ctx.callbackQuery.data;
      const menuCallback = menuCallbackSchema.safeParse(callbackData);

      if (menuCallback.success) {
        await handleMenuCallback(ctx, menuCallback.data);
        return;
      }

      const parts = callbackData.split(":");
      const productCallback = productCallbackSchema.safeParse(parts);

      if (productCallback.success) {
        await showProduct(ctx, productCallback.data[1]);
        return;
      }

      const selectionCallback = selectionCallbackSchema.safeParse(parts);

      if (selectionCallback.success) {
        const [action, productId, variantId] = selectionCallback.data;

        if (action === "size") {
          await handleSizeSelection(ctx, productId, variantId);
          return;
        }

        await handleColorSelection(ctx, productId, variantId);
        return;
      }

      logger.warn("Noma’lum callback qabul qilindi", {
        callbackData,
        updateId: ctx.update.update_id,
      });
      await ctx.reply(
        "Bu tugma eskirgan yoki noto‘g‘ri. /start orqali bosh menyuga qayting.",
        {
          reply_markup: createMainMenuKeyboard(),
        },
      );
    } catch (error) {
      logger.error("Callback handlerida xato yuz berdi", error, {
        updateId: ctx.update.update_id,
      });
      await ctx.reply(
        "Amalni bajarishda xato yuz berdi. Iltimos, qayta urinib ko‘ring.",
        {
          reply_markup: createMainMenuKeyboard(),
        },
      );
    }
  });
}
