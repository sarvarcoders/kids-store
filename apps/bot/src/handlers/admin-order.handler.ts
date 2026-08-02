import type { OrderStatus } from "@kids-store/shared";
import type { Bot } from "grammy";

import {
  adminLauncherOptionsSchema,
  isAdminTelegramUser,
} from "../config/admin-launcher.js";
import {
  ADMIN_ORDERS_LIST_CALLBACK,
  parseAdminOrderCallbackData,
  type AdminOrderAction,
} from "../config/admin-order.js";
import { logger } from "../config/logger.js";
import { createAdminOrderKeyboard } from "../keyboards/admin-order.keyboard.js";
import {
  formatAdminManagedOrder,
  formatCustomerOrderProgress,
} from "../services/admin-order.formatter.js";
import {
  AdminOrderServiceError,
  type AdminManagedOrder,
  type AdminOrderService,
} from "../services/admin-order.service.js";
import type { BotContext } from "../types/bot-context.js";
import { ADMIN_ACCESS_DENIED_MESSAGE } from "./admin.handler.js";

const ADMIN_ORDER_ERROR_MESSAGE =
  "Buyurtma ma’lumotlarini boshqarishda xato yuz berdi. Iltimos, qayta urinib ko‘ring.";

interface AdminOrderHandlerOptions {
  allowedAdminIds: string[];
}

const actionStatuses: Readonly<
  Partial<Record<AdminOrderAction, OrderStatus>>
> = {
  payment: "CONFIRMED",
  ready: "PROCESSING",
  shipped: "SHIPPED",
  delivered: "DELIVERED",
  cancel_confirm: "CANCELLED",
};

function isAllowedAdmin(
  ctx: BotContext,
  allowedAdminIds: readonly string[],
): boolean {
  return isAdminTelegramUser(ctx.from?.id, allowedAdminIds);
}

function isMessageNotModified(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.toLocaleLowerCase("en").includes("message is not modified")
  );
}

async function editOrderMessage(
  ctx: BotContext,
  order: AdminManagedOrder,
  confirmCancellation = false,
): Promise<void> {
  try {
    await ctx.editMessageText(formatAdminManagedOrder(order), {
      reply_markup: createAdminOrderKeyboard(order, {
        confirmCancellation,
      }),
    });
  } catch (error) {
    if (!isMessageNotModified(error)) {
      throw error;
    }
  }
}

async function sendOpenOrders(
  ctx: BotContext,
  orderService: AdminOrderService,
): Promise<void> {
  const result = await orderService.listOpenOrders(10);
  const { orders } = result;

  if (orders.length === 0) {
    await ctx.reply("✅ Hozir faol zakazlar yo‘q.");
    return;
  }

  await ctx.reply(
    [
      `📋 Jami faol zakazlar: ${String(result.total)} ta`,
      "",
      `Eng eski ${String(orders.length)} ta zakaz ko‘rsatildi. Har birini quyidagi tugmalar orqali boshqaring.`,
      ...(result.total > orders.length
        ? [
            "",
            "Ko‘rsatilmagan zakazlar eng eski zakazlar yopilgach yoki ro‘yxat yangilanganda navbat bilan chiqadi.",
          ]
        : []),
    ].join("\n"),
  );

  for (const order of orders) {
    await ctx.reply(formatAdminManagedOrder(order), {
      reply_markup: createAdminOrderKeyboard(order),
    });
  }
}

async function notifyCustomer(
  ctx: BotContext,
  order: AdminManagedOrder,
): Promise<boolean> {
  try {
    await ctx.api.sendMessage(
      order.customer.telegramUserId.toString(),
      formatCustomerOrderProgress({
        orderId: order.id,
        status: order.status,
      }),
    );
    return true;
  } catch (error) {
    logger.error("Buyurtma statusi bo‘yicha mijozga xabar yuborilmadi", error, {
      orderId: order.id,
      status: order.status,
    });
    return false;
  }
}

function getServiceErrorMessage(error: AdminOrderServiceError): string {
  switch (error.code) {
    case "ORDER_NOT_FOUND":
      return "Buyurtma topilmadi.";
    case "INVALID_TRANSITION":
      return "Bu tugma eskirgan. Buyurtma holatini yangilang.";
    case "CONCURRENT_UPDATE":
      return "Buyurtma boshqa admin tomonidan yangilandi. Qayta yangilang.";
  }
}

async function handleOrderAction(
  ctx: BotContext,
  orderService: AdminOrderService,
  adminTelegramId: string,
  orderId: number,
  action: AdminOrderAction,
): Promise<void> {
  if (action === "refresh") {
    const order = await orderService.getOrder(orderId);

    if (!order) {
      throw new AdminOrderServiceError("ORDER_NOT_FOUND", "Buyurtma topilmadi");
    }

    await editOrderMessage(ctx, order);
    return;
  }

  if (action === "cancel_request") {
    const order = await orderService.getOrder(orderId);

    if (!order) {
      throw new AdminOrderServiceError("ORDER_NOT_FOUND", "Buyurtma topilmadi");
    }

    if (order.status !== "PENDING" && order.status !== "CONFIRMED") {
      throw new AdminOrderServiceError(
        "INVALID_TRANSITION",
        "Bu buyurtmani bekor qilib bo‘lmaydi",
      );
    }

    await editOrderMessage(ctx, order, true);
    return;
  }

  if (action === "contacted") {
    const result = await orderService.markCustomerContacted(
      adminTelegramId,
      orderId,
    );
    await editOrderMessage(ctx, result.order);
    return;
  }

  if (action === "notify") {
    const order = await orderService.getOrder(orderId);

    if (!order) {
      throw new AdminOrderServiceError("ORDER_NOT_FOUND", "Buyurtma topilmadi");
    }

    const delivered = await notifyCustomer(ctx, order);
    await ctx.reply(
      delivered
        ? `✅ #${String(order.id)} buyurtma holati mijozga yuborildi.`
        : "Status saqlangan, lekin mijozga xabar yuborilmadi. Keyinroq qayta urinib ko‘ring.",
    );
    return;
  }

  const nextStatus = actionStatuses[action];

  if (!nextStatus) {
    throw new AdminOrderServiceError(
      "INVALID_TRANSITION",
      "Noto‘g‘ri status amali",
    );
  }

  const result = await orderService.transitionOrder(
    adminTelegramId,
    orderId,
    nextStatus,
  );
  await editOrderMessage(ctx, result.order);

  if (!result.wasDuplicate) {
    const delivered = await notifyCustomer(ctx, result.order);

    if (!delivered) {
      await ctx.reply(
        "Status bazada saqlandi, lekin mijozga xabar yuborilmadi. “🔔 Mijozga xabar yuborish” tugmasi orqali qayta urinishingiz mumkin.",
      );
    }
  }
}

export function registerAdminOrderHandler(
  bot: Bot<BotContext>,
  orderService: AdminOrderService,
  options: AdminOrderHandlerOptions,
): void {
  const validatedOptions = adminLauncherOptionsSchema
    .pick({ allowedAdminIds: true })
    .parse(options);

  const listCommandHandler = async (ctx: BotContext): Promise<void> => {
    if (!isAllowedAdmin(ctx, validatedOptions.allowedAdminIds)) {
      await ctx.reply(ADMIN_ACCESS_DENIED_MESSAGE);
      return;
    }

    try {
      await sendOpenOrders(ctx, orderService);
    } catch (error) {
      logger.error("Faol zakazlarni yuklashda xato", error, {
        updateId: ctx.update.update_id,
      });
      await ctx.reply(ADMIN_ORDER_ERROR_MESSAGE);
    }
  };

  bot.command("orders", listCommandHandler);
  bot.command("zakazlar", listCommandHandler);

  bot.callbackQuery(ADMIN_ORDERS_LIST_CALLBACK, async (ctx) => {
    if (!isAllowedAdmin(ctx, validatedOptions.allowedAdminIds)) {
      await ctx.answerCallbackQuery({
        show_alert: true,
        text: ADMIN_ACCESS_DENIED_MESSAGE,
      });
      return;
    }

    await ctx.answerCallbackQuery();

    try {
      await sendOpenOrders(ctx, orderService);
    } catch (error) {
      logger.error("Faol zakazlar callbackida xato", error, {
        updateId: ctx.update.update_id,
      });
      await ctx.reply(ADMIN_ORDER_ERROR_MESSAGE);
    }
  });

  bot.callbackQuery(/^admin_order:/, async (ctx) => {
    if (!isAllowedAdmin(ctx, validatedOptions.allowedAdminIds)) {
      await ctx.answerCallbackQuery({
        show_alert: true,
        text: ADMIN_ACCESS_DENIED_MESSAGE,
      });
      return;
    }

    const parsed = (() => {
      try {
        return parseAdminOrderCallbackData(ctx.callbackQuery.data);
      } catch {
        return null;
      }
    })();

    if (!parsed) {
      await ctx.answerCallbackQuery({
        show_alert: true,
        text: "Bu buyurtma tugmasi noto‘g‘ri yoki eskirgan.",
      });
      return;
    }

    await ctx.answerCallbackQuery();

    try {
      await handleOrderAction(
        ctx,
        orderService,
        String(ctx.from.id),
        parsed.orderId,
        parsed.action,
      );
    } catch (error) {
      logger.error("Admin order callbackida xato", error, {
        action: parsed.action,
        orderId: parsed.orderId,
        updateId: ctx.update.update_id,
      });
      await ctx.reply(
        error instanceof AdminOrderServiceError
          ? getServiceErrorMessage(error)
          : ADMIN_ORDER_ERROR_MESSAGE,
      );
    }
  });
}
