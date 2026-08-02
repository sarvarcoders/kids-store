import {
  createNotificationWorker,
  createRedisConnection,
  sendTelegramTextMessage,
  type NotificationWorkerHandle,
} from "@kids-store/core";

import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import {
  botRedisConfig,
  logRedisWorkerError,
} from "../config/redis.js";

export interface BotNotificationWorkerHandle {
  close(): Promise<void>;
}

export function startBotNotificationWorker(): BotNotificationWorkerHandle | undefined {
  if (botRedisConfig === null) {
    logger.warn("Notification queue o‘chirilgan: REDIS_URL mavjud emas");
    return undefined;
  }

  const connection = createRedisConnection(botRedisConfig, "worker");
  const worker: NotificationWorkerHandle = createNotificationWorker({
    connection,
    keyPrefix: botRedisConfig.keyPrefix,
    concurrency: 5,
    async send(notification) {
      await sendTelegramTextMessage(
        {
          botToken: env.TELEGRAM_BOT_TOKEN,
          chatId: notification.chatId,
          text: notification.text,
        },
        { maxAttempts: 1 },
      );
    },
    onError(error) {
      logRedisWorkerError(error);
    },
  });

  logger.info("Notification queue worker ishga tushdi", { concurrency: 5 });

  return {
    async close(): Promise<void> {
      await worker.close();
      await connection.quit();
    },
  };
}
