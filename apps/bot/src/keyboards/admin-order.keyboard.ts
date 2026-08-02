import { orderStatusSchema } from "@kids-store/shared";
import { InlineKeyboard } from "grammy";
import { z } from "zod";

import {
  ADMIN_ORDERS_LIST_CALLBACK,
  createAdminOrderCallbackData,
  type AdminOrderAction,
} from "../config/admin-order.js";
import { databaseIdSchema } from "../config/validation.js";

const keyboardOrderSchema = z.object({
  id: databaseIdSchema,
  status: orderStatusSchema,
  contactedAt: z.date().nullable(),
  customer: z.object({
    telegramUserId: z.bigint().positive(),
    username: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9_]{5,32}$/)
      .nullable(),
  }),
});
const keyboardOptionsSchema = z.object({
  confirmCancellation: z.boolean().default(false),
});

const nextActions: Readonly<
  Partial<
    Record<
      z.infer<typeof orderStatusSchema>,
      { action: AdminOrderAction; text: string }
    >
  >
> = {
  PENDING: { action: "payment", text: "💳 To‘lov tasdiqlandi" },
  CONFIRMED: { action: "ready", text: "📦 Buyurtma tayyor" },
  PROCESSING: { action: "shipped", text: "🚚 Dostavkaga yuborildi" },
  SHIPPED: { action: "delivered", text: "✅ Yetkazildi" },
};

export function createCustomerTelegramUrl(input: {
  telegramUserId: unknown;
  username?: unknown;
}): string {
  const parsed = z
    .object({
      telegramUserId: z.bigint().positive(),
      username: z
        .string()
        .trim()
        .regex(/^[A-Za-z0-9_]{5,32}$/)
        .nullable()
        .optional(),
    })
    .parse(input);

  return parsed.username
    ? `https://t.me/${parsed.username}`
    : `tg://user?id=${parsed.telegramUserId.toString()}`;
}

export function createAdminOrderKeyboard(
  orderInput: unknown,
  optionsInput: unknown = {},
): InlineKeyboard {
  const order = keyboardOrderSchema.parse(orderInput);
  const options = keyboardOptionsSchema.parse(optionsInput);
  const keyboard = new InlineKeyboard()
    .url(
      "💬 Mijozga yozish",
      createCustomerTelegramUrl({
        telegramUserId: order.customer.telegramUserId,
        username: order.customer.username,
      }),
    )
    .row()
    .text(
      order.contactedAt ? "✅ Bog‘lanilgan" : "📞 Bog‘landim",
      createAdminOrderCallbackData("contacted", order.id),
    );
  const nextAction = nextActions[order.status];

  if (nextAction && !options.confirmCancellation) {
    keyboard
      .row()
      .text(
        nextAction.text,
        createAdminOrderCallbackData(nextAction.action, order.id),
      );
  }

  if (options.confirmCancellation) {
    keyboard
      .row()
      .text(
        "⚠️ Ha, bekor qilish",
        createAdminOrderCallbackData("cancel_confirm", order.id),
      )
      .text(
        "Ortga",
        createAdminOrderCallbackData("refresh", order.id),
      );
  } else if (order.status === "PENDING" || order.status === "CONFIRMED") {
    keyboard
      .row()
      .text(
        "❌ Bekor qilish",
        createAdminOrderCallbackData("cancel_request", order.id),
      );
  }

  if (order.status !== "PENDING" && !options.confirmCancellation) {
    keyboard
      .row()
      .text(
        "🔔 Mijozga xabar yuborish",
        createAdminOrderCallbackData("notify", order.id),
      );
  }

  return keyboard
    .row()
    .text("🔄 Yangilash", createAdminOrderCallbackData("refresh", order.id))
    .text("📋 Faol zakazlar", ADMIN_ORDERS_LIST_CALLBACK);
}
