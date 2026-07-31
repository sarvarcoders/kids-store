import { randomUUID } from "node:crypto";

import {
  addressSchema,
  orderIdempotencyKeySchema,
  orderQuantitySchema,
  phoneSchema,
} from "@kids-store/shared";
import type { Bot } from "grammy";
import { z } from "zod";

import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { databaseIdSchema } from "../config/validation.js";
import { createMainMenuKeyboard } from "../keyboards/main-menu.keyboard.js";
import {
  CANCEL_ORDER_TEXT,
  createContactKeyboard,
  createOrderConfirmationKeyboard,
} from "../keyboards/order.keyboard.js";
import {
  formatAdminOrderCreated,
  formatCustomerOrderCreated,
  formatOrderConfirmation,
  type CreatedOrderMessageInput,
} from "../services/order-message.formatter.js";
import {
  OrderServiceError,
  type OrderService,
} from "../services/order.service.js";
import { findActiveProductVariant } from "../services/product.service.js";
import type {
  BotContext,
  OrderDraft,
} from "../types/bot-context.js";

const callbackIdSchema = z
  .string()
  .regex(/^[1-9]\d*$/)
  .transform((value) => databaseIdSchema.parse(value));
const quantityCallbackSchema = z.tuple([
  z.literal("order"),
  z.literal("quantity"),
  callbackIdSchema,
  z.string().transform((value) => orderQuantitySchema.parse(value)),
]);
const confirmationCallbackSchema = z.tuple([
  z.literal("order"),
  z.enum(["confirm", "cancel"]),
  orderIdempotencyKeySchema,
]);
const readyOrderDraftSchema = z.object({
  productId: databaseIdSchema,
  productVariantId: databaseIdSchema,
  productName: z.string().trim().min(1).max(160),
  selectedSize: z.string().trim().min(1).max(50),
  selectedColor: z.string().trim().min(1).max(80),
  unitPrice: z.number().int().nonnegative(),
  availableStock: z.number().int().positive(),
  step: z.literal("awaiting_confirmation"),
  quantity: orderQuantitySchema,
  phone: phoneSchema,
  deliveryAddress: addressSchema,
  confirmationToken: orderIdempotencyKeySchema,
});

async function answerOrderCallback(ctx: BotContext): Promise<void> {
  try {
    await ctx.answerCallbackQuery();
  } catch (error) {
    logger.warn("Buyurtma callback query’siga javob berib bo‘lmadi", {
      updateId: ctx.update.update_id,
      error: error instanceof Error ? error.message : error,
    });
  }
}

async function cancelOrder(ctx: BotContext): Promise<void> {
  ctx.session.productSelection = null;
  ctx.session.orderDraft = null;
  await ctx.reply("Buyurtma bekor qilindi.", {
    reply_markup: {
      remove_keyboard: true,
    },
  });
}

async function handleQuantityCallback(
  ctx: BotContext,
  productVariantId: number,
  quantity: number,
): Promise<void> {
  const draft = ctx.session.orderDraft;

  if (
    draft?.step !== "selecting_quantity" ||
    draft.productVariantId !== productVariantId
  ) {
    await ctx.reply(
      "Bu miqdor tanlovi eskirgan. Mahsulot variantini qayta tanlang.",
      {
        reply_markup: createMainMenuKeyboard(),
      },
    );
    return;
  }

  const selection = await findActiveProductVariant(
    draft.productId,
    productVariantId,
  );
  const variant = selection?.variant;

  if (!selection || !variant) {
    ctx.session.orderDraft = null;
    await ctx.reply(
      "Tanlangan variant hozir mavjud emas. Mahsulotni qayta ochib ko‘ring.",
      {
        reply_markup: createMainMenuKeyboard(),
      },
    );
    return;
  }

  if (quantity > variant.stock) {
    await ctx.reply(
      `Omborda faqat ${String(variant.stock)} dona mavjud. Kamroq miqdor tanlang.`,
    );
    return;
  }

  const unitPrice =
    selection.discountPrice !== null &&
    selection.discountPrice < selection.price
      ? selection.discountPrice
      : selection.price;

  ctx.session.orderDraft = {
    ...draft,
    productName: selection.productName,
    selectedSize: variant.size,
    selectedColor: variant.color,
    unitPrice,
    availableStock: variant.stock,
    quantity,
    step: "awaiting_phone",
  };

  await ctx.reply(
    [
      `Miqdor: ${String(quantity)} dona.`,
      "",
      "Telefon raqamingizni yuboring.",
      "Quyidagi kontakt tugmasidan foydalaning yoki +998901234567 formatida yozing.",
    ].join("\n"),
    {
      reply_markup: createContactKeyboard(),
    },
  );
}

async function requestAddress(
  ctx: BotContext,
  draft: OrderDraft,
  phone: string,
): Promise<void> {
  ctx.session.orderDraft = {
    ...draft,
    phone,
    step: "awaiting_address",
  };

  await ctx.reply(
    "Yetkazib berish manzilini yozing. Viloyat/shahar, ko‘cha va uy raqamini kiriting.",
    {
      reply_markup: {
        remove_keyboard: true,
      },
    },
  );
}

async function handleContactMessage(ctx: BotContext): Promise<void> {
  const draft = ctx.session.orderDraft;

  if (draft?.step !== "awaiting_phone") {
    return;
  }

  const contact = ctx.message?.contact;
  const senderId = ctx.from?.id;

  if (
    !contact ||
    senderId === undefined ||
    contact.user_id === undefined ||
    contact.user_id !== senderId
  ) {
    await ctx.reply(
      "Iltimos, aynan o‘zingizning kontaktingizni yuboring yoki telefon raqamingizni matn orqali kiriting.",
    );
    return;
  }

  const parsedPhone = phoneSchema.safeParse(contact.phone_number);

  if (!parsedPhone.success) {
    await ctx.reply(
      "Telefon raqami noto‘g‘ri. Uni +998901234567 formatida matn orqali kiriting.",
    );
    return;
  }

  await requestAddress(ctx, draft, parsedPhone.data);
}

async function handleTextMessage(ctx: BotContext): Promise<void> {
  const draft = ctx.session.orderDraft;
  const text = ctx.message?.text?.trim();

  if (!draft || !text) {
    return;
  }

  if (text === CANCEL_ORDER_TEXT) {
    await cancelOrder(ctx);
    return;
  }

  if (draft.step === "awaiting_phone") {
    const parsedPhone = phoneSchema.safeParse(text);

    if (!parsedPhone.success) {
      await ctx.reply(
        "Telefon raqami noto‘g‘ri. +998901234567 formatida kiriting yoki kontakt tugmasidan foydalaning.",
      );
      return;
    }

    await requestAddress(ctx, draft, parsedPhone.data);
    return;
  }

  if (draft.step !== "awaiting_address") {
    return;
  }

  const parsedAddress = addressSchema.safeParse(text);

  if (!parsedAddress.success) {
    await ctx.reply(
      "Manzil bo‘sh bo‘lmasligi, kamida 5 ta va ko‘pi bilan 500 ta belgidan iborat bo‘lishi kerak.",
    );
    return;
  }

  if (draft.quantity === undefined || draft.phone === undefined) {
    ctx.session.orderDraft = null;
    await ctx.reply(
      "Buyurtma ma’lumotlari to‘liq emas. Mahsulotni qayta tanlang.",
      {
        reply_markup: createMainMenuKeyboard(),
      },
    );
    return;
  }

  const confirmationToken = randomUUID();
  const readyDraft: OrderDraft = {
    ...draft,
    deliveryAddress: parsedAddress.data,
    confirmationToken,
    step: "awaiting_confirmation",
  };
  ctx.session.orderDraft = readyDraft;

  await ctx.reply(
    formatOrderConfirmation({
      productName: readyDraft.productName,
      size: readyDraft.selectedSize,
      color: readyDraft.selectedColor,
      quantity: draft.quantity,
      unitPrice: readyDraft.unitPrice,
      phone: draft.phone,
      deliveryAddress: parsedAddress.data,
    }),
    {
      reply_markup: createOrderConfirmationKeyboard(confirmationToken),
    },
  );
}

async function sendAdminNotification(
  ctx: BotContext,
  message: CreatedOrderMessageInput,
): Promise<void> {
  try {
    await ctx.api.sendMessage(
      env.ADMIN_TELEGRAM_ID.toString(),
      formatAdminOrderCreated(message),
    );
  } catch (error) {
    logger.error("Yangi buyurtma adminiga xabar yuborilmadi", error, {
      orderId: message.orderId,
    });
  }
}

async function handleConfirmCallback(
  ctx: BotContext,
  confirmationToken: string,
  orderService: OrderService,
): Promise<void> {
  const currentDraft = ctx.session.orderDraft;

  if (
    currentDraft?.confirmationToken === confirmationToken &&
    currentDraft.step === "submitting"
  ) {
    await ctx.reply("Buyurtma hozir qayta ishlanmoqda. Iltimos, kuting.");
    return;
  }

  if (
    currentDraft?.confirmationToken === confirmationToken &&
    currentDraft.step === "completed"
  ) {
    await ctx.reply(
      `Bu buyurtma avval qabul qilingan. Buyurtma ID: ${String(currentDraft.createdOrderId ?? "")}`,
    );
    return;
  }

  const parsedDraft = readyOrderDraftSchema.safeParse(currentDraft);

  if (
    !parsedDraft.success ||
    parsedDraft.data.confirmationToken !== confirmationToken ||
    !ctx.from
  ) {
    await ctx.reply(
      "Tasdiqlash oynasi eskirgan. Mahsulotni qayta tanlang.",
      {
        reply_markup: createMainMenuKeyboard(),
      },
    );
    return;
  }

  const draft = parsedDraft.data;
  ctx.session.orderDraft = {
    ...draft,
    step: "submitting",
  };

  const usernameData =
    ctx.from.username === undefined ? {} : { username: ctx.from.username };

  try {
    const result = await orderService.createOrder({
      productVariantId: draft.productVariantId,
      quantity: draft.quantity,
      deliveryAddress: draft.deliveryAddress,
      idempotencyKey: draft.confirmationToken,
      customer: {
        telegramUserId: BigInt(ctx.from.id),
        firstName: ctx.from.first_name,
        phone: draft.phone,
        ...usernameData,
      },
    });
    const message: CreatedOrderMessageInput = {
      orderId: result.order.id,
      status: result.order.status,
      totalAmount: result.order.totalAmount,
      productName: result.order.item.productName,
      size: result.order.item.size,
      color: result.order.item.color,
      quantity: result.order.item.quantity,
      unitPrice: result.order.item.unitPrice,
      phone: result.order.customer.phone ?? draft.phone,
      deliveryAddress: result.order.deliveryAddress,
      telegramUserId: result.order.customer.telegramUserId,
      ...(result.order.customer.username
        ? { username: result.order.customer.username }
        : {}),
    };

    ctx.session.productSelection = null;
    ctx.session.orderDraft = {
      ...draft,
      step: "completed",
      createdOrderId: result.order.id,
    };

    await ctx.reply(
      `${
        result.wasDuplicate ? "Bu buyurtma avval qabul qilingan.\n\n" : ""
      }${formatCustomerOrderCreated(message)}`,
    );

    if (!result.wasDuplicate) {
      await sendAdminNotification(ctx, message);
    }
  } catch (error) {
    logger.error("Buyurtmani yaratishda xato", error, {
      updateId: ctx.update.update_id,
      productVariantId: draft.productVariantId,
    });

    if (
      error instanceof OrderServiceError &&
      (error.code === "INSUFFICIENT_STOCK" ||
        error.code === "PRODUCT_NOT_AVAILABLE")
    ) {
      ctx.session.productSelection = null;
      ctx.session.orderDraft = null;
      await ctx.reply(
        "Afsuski, tanlangan variant yoki miqdor endi mavjud emas. Mahsulotni qayta ochib, boshqa variant tanlang.",
        {
          reply_markup: createMainMenuKeyboard(),
        },
      );
      return;
    }

    ctx.session.orderDraft = {
      ...draft,
      step: "awaiting_confirmation",
    };
    await ctx.reply(
      "Buyurtmani yaratishda xato yuz berdi. Maxfiy ma’lumotlaringiz oshkor qilinmadi. Iltimos, qayta urinib ko‘ring.",
      {
        reply_markup: createOrderConfirmationKeyboard(confirmationToken),
      },
    );
  }
}

async function handleOrderCallback(
  ctx: BotContext,
  orderService: OrderService,
): Promise<void> {
  await answerOrderCallback(ctx);
  const callbackData = ctx.callbackQuery?.data;

  if (!callbackData) {
    return;
  }

  if (callbackData === "order:abort") {
    await cancelOrder(ctx);
    return;
  }

  const callbackParts = callbackData.split(":");
  const quantityCallback = quantityCallbackSchema.safeParse(callbackParts);

  if (quantityCallback.success) {
    await handleQuantityCallback(
      ctx,
      quantityCallback.data[2],
      quantityCallback.data[3],
    );
    return;
  }

  const confirmationCallback =
    confirmationCallbackSchema.safeParse(callbackParts);

  if (confirmationCallback.success) {
    const [, action, confirmationToken] = confirmationCallback.data;

    if (action === "cancel") {
      if (
        ctx.session.orderDraft?.confirmationToken !== confirmationToken
      ) {
        await ctx.reply("Bu bekor qilish tugmasi eskirgan.");
        return;
      }

      await cancelOrder(ctx);
      return;
    }

    await handleConfirmCallback(ctx, confirmationToken, orderService);
    return;
  }

  await ctx.reply(
    "Bu buyurtma tugmasi eskirgan. Mahsulotni qayta tanlang.",
    {
      reply_markup: createMainMenuKeyboard(),
    },
  );
}

export function registerOrderHandlers(
  bot: Bot<BotContext>,
  orderService: OrderService,
): void {
  bot.callbackQuery(/^order:/, async (ctx) => {
    try {
      await handleOrderCallback(ctx, orderService);
    } catch (error) {
      logger.error("Buyurtma callback handlerida xato", error, {
        updateId: ctx.update.update_id,
      });
      await ctx.reply(
        "Amalni bajarishda xato yuz berdi. Iltimos, qayta urinib ko‘ring.",
      );
    }
  });

  bot.on("message:contact", async (ctx) => {
    try {
      await handleContactMessage(ctx);
    } catch (error) {
      logger.error("Contact handlerida xato", error, {
        updateId: ctx.update.update_id,
      });
      await ctx.reply(
        "Telefon raqamini qabul qilishda xato yuz berdi. Uni matn orqali kiriting.",
      );
    }
  });

  bot.on("message:text", async (ctx) => {
    try {
      await handleTextMessage(ctx);
    } catch (error) {
      logger.error("Buyurtma text handlerida xato", error, {
        updateId: ctx.update.update_id,
      });
      await ctx.reply(
        "Ma’lumotni qabul qilishda xato yuz berdi. Iltimos, qayta urinib ko‘ring.",
      );
    }
  });
}
