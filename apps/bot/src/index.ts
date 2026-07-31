import { autoRetry } from "@grammyjs/auto-retry";
import { run, sequentialize } from "@grammyjs/runner";
import { closeRedisProducers } from "@kids-store/core";
import { Bot, session } from "grammy";

import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import {
  BOT_ALLOWED_UPDATES,
  BOT_RUNNER_CONCURRENCY,
  BOT_UPDATE_TIMEOUT_MS,
  getBotSessionKey,
} from "./config/performance.js";
import { registerAdminHandler } from "./handlers/admin.handler.js";
import { registerCallbackHandlers } from "./handlers/callback.handler.js";
import { registerOrderHandlers } from "./handlers/order.handler.js";
import { registerPublishHandler } from "./handlers/publish.handler.js";
import { registerStartHandler } from "./handlers/start.handler.js";
import { ChannelPostService } from "./services/channel-post.service.js";
import { OrderService } from "./services/order.service.js";
import { startBotNotificationWorker } from "./services/notification-worker.js";
import { createBotSessionStorage } from "./services/session-storage.js";
import {
  createInitialSession,
  type BotContext,
} from "./types/bot-context.js";

const bot = new Bot<BotContext>(env.TELEGRAM_BOT_TOKEN);

bot.api.config.use(
  autoRetry({
    maxDelaySeconds: 30,
    maxRetryAttempts: 3,
  }),
);
bot.use(sequentialize(getBotSessionKey));
bot.use(
  session({
    initial: createInitialSession,
    getSessionKey: getBotSessionKey,
    storage: createBotSessionStorage(),
  }),
);

registerStartHandler(bot);
registerAdminHandler(bot, {
  adminAppUrl: env.ADMIN_APP_URL,
  allowedAdminIds: env.ADMIN_TELEGRAM_IDS,
});
registerPublishHandler(bot, new ChannelPostService(bot.api));
registerOrderHandlers(bot, new OrderService());
registerCallbackHandlers(bot);

bot.catch((botError) => {
  logger.error("Bot update’ni qayta ishlashda xato yuz berdi", botError.error, {
    updateId: botError.ctx.update.update_id,
  });
});

let isStopping = false;
let runnerHandle: ReturnType<typeof run> | undefined;
let notificationWorker: ReturnType<typeof startBotNotificationWorker>;

async function stopBot(signal: NodeJS.Signals): Promise<void> {
  if (isStopping) {
    return;
  }

  isStopping = true;
  logger.info("Bot to‘xtatilmoqda", { signal });

  try {
    await runnerHandle?.stop();
    await notificationWorker?.close();
    await closeRedisProducers();
    logger.info("Bot muvaffaqiyatli to‘xtatildi", { signal });
  } catch (error) {
    logger.error("Botni to‘xtatishda xato yuz berdi", error, { signal });
  }
}

process.once("SIGINT", () => void stopBot("SIGINT"));
process.once("SIGTERM", () => void stopBot("SIGTERM"));

try {
  await bot.init();
  notificationWorker = startBotNotificationWorker();
  logger.info("Telegram bot ishga tushdi", {
    concurrency: BOT_RUNNER_CONCURRENCY,
    username: bot.botInfo.username,
  });
  runnerHandle = run(bot, {
    runner: {
      fetch: {
        allowed_updates: BOT_ALLOWED_UPDATES,
      },
      retryInterval: "exponential",
    },
    sink: {
      concurrency: BOT_RUNNER_CONCURRENCY,
      timeout: {
        milliseconds: BOT_UPDATE_TIMEOUT_MS,
        handler(update) {
          logger.warn("Bot update belgilangan vaqtdan oshib ketdi", {
            updateId: update.update_id,
          });
        },
      },
    },
  });
  await runnerHandle.task();
} catch (error) {
  logger.error("Telegram botni ishga tushirib bo‘lmadi", error);
  process.exitCode = 1;
}
