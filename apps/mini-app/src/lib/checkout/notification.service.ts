import "server-only";

import {
  formatAdminOrderNotification,
  formatCustomerOrderNotification,
  type CheckoutOrderDto,
  type OrderNotificationInput,
  type VerifiedTelegramUserDto,
} from "@kids-store/shared";
import {
  createNotificationQueue,
  sendTelegramTextMessage,
  type NotificationJobData,
  type NotificationQueueHandle,
} from "@kids-store/core";

import { logServerError } from "../api/response";
import { serverEnv } from "../env/server";
import {
  getMiniAppRedisProducer,
  miniAppRedisConfig,
} from "../redis/server";
import { runNotificationSafely } from "./notification-runner";

const notificationQueue: NotificationQueueHandle | undefined = (() => {
  const connection = getMiniAppRedisProducer();

  return connection === undefined || miniAppRedisConfig === null
    ? undefined
    : createNotificationQueue({
        connection,
        keyPrefix: miniAppRedisConfig.keyPrefix,
        onError(error) {
          logServerError("checkout-notification-queue", error);
        },
      });
})();

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

async function enqueueOrSend(notification: NotificationJobData): Promise<void> {
  if (notificationQueue) {
    try {
      await notificationQueue.enqueue(notification);
      return;
    } catch (error) {
      logServerError("checkout-notification-queue-fallback", error);
    }
  }

  await sendTelegramMessage(notification.chatId, notification.text);
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
  const notifications: NotificationJobData[] = [
    {
      chatId: user.id,
      eventId: `checkout-${String(order.id)}-customer`,
      kind: "checkout_customer",
      text: formatCustomerOrderNotification(notification),
    },
    ...(adminId === undefined
      ? []
      : [
          {
            chatId: adminId,
            eventId: `checkout-${String(order.id)}-admin`,
            kind: "checkout_admin" as const,
            text: formatAdminOrderNotification(notification),
          },
        ]),
  ];
  const results = await Promise.allSettled(
    notifications.map(enqueueOrSend),
  );

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
