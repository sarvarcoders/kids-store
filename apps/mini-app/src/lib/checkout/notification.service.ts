import "server-only";

import {
  formatAdminOrderNotification,
  formatCustomerOrderNotification,
  type CheckoutOrderDto,
  type OrderNotificationInput,
  type VerifiedTelegramUserDto,
} from "@kids-store/shared";
import { sendTelegramTextMessage } from "@kids-store/core";

import { logServerError } from "../api/response";
import { serverEnv } from "../env/server";
import { runNotificationSafely } from "./notification-runner";

async function sendTelegramMessage(
  chatId: string,
  text: string,
): Promise<void> {
  const botToken = serverEnv.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    throw new Error("Telegram bot server konfiguratsiyasi mavjud emas.");
  }

  await sendTelegramTextMessage({ botToken, chatId, text });
}

async function deliverCheckoutNotifications(
  user: VerifiedTelegramUserDto,
  order: CheckoutOrderDto,
): Promise<void> {
  const notification: OrderNotificationInput = {
    orderId: order.id,
    status: order.status,
    totalAmount: order.totalAmount,
    phone: order.phone,
    deliveryAddress: order.deliveryAddress,
    telegramUserId: user.id,
    ...(user.username === undefined || user.username.length > 32
      ? {}
      : { username: user.username }),
    items: order.items.map((item) => ({
      productName: item.productName,
      size: item.size,
      color: item.color,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    })),
  };
  const adminId = serverEnv.ADMIN_TELEGRAM_ID;
  const notifications = [
    sendTelegramMessage(
      user.id,
      formatCustomerOrderNotification(notification),
    ),
    ...(adminId === undefined
      ? []
      : [
          sendTelegramMessage(
            adminId,
            formatAdminOrderNotification(notification),
          ),
        ]),
  ];
  const results = await Promise.allSettled(notifications);

  results.forEach((result, index) => {
    if (result.status === "rejected") {
      logServerError(
        index === 0
          ? "checkout-customer-notification"
          : "checkout-admin-notification",
        result.reason,
      );
    }
  });
}

export async function sendCheckoutNotifications(
  user: VerifiedTelegramUserDto,
  order: CheckoutOrderDto,
): Promise<void> {
  await runNotificationSafely(
    () => deliverCheckoutNotifications(user, order),
    (error) => {
      logServerError("checkout-notification", error);
    },
  );
}
