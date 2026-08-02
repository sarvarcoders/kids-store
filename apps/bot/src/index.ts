import { autoRetry } from "@grammyjs/auto-retry";
import { run, sequentialize } from "@grammyjs/runner";
import { closeRedisProducers } from "@kids-store/core";
import { prisma } from "@kids-store/database";
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
import { registerAdminOrderHandler } from "./handlers/admin-order.handler.js";
import { registerAdminStatisticsHandler } from "./handlers/admin-statistics.handler.js";
import { registerCallbackHandlers } from "./handlers/callback.handler.js";
import { registerOrderHandlers } from "./handlers/order.handler.js";
import { registerPublishHandler } from "./handlers/publish.handler.js";
import { registerStartHandler } from "./handlers/start.handler.js";
import { ChannelPostService } from "./services/channel-post.service.js";
import { AdminOrderService } from "./services/admin-order.service.js";
import { AdminStatisticsService } from "./services/admin-statistics.service.js";
import { OrderService } from "./services/order.service.js";
import { startBotNotificationWorker } from "./services/notification-worker.js";
import { createBotSessionStorage } from "./services/session-storage.js";
import { configureBotCommandMenu } from "./services/bot-command-menu.js";
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
registerAdminOrderHandler(bot, new AdminOrderService(), {
  allowedAdminIds: env.ADMIN_TELEGRAM_IDS,
});
registerAdminStatisticsHandler(bot, new AdminStatisticsService(), {
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

function isShutdownRequested(): boolean {
  return isStopping;
}

async function stopBot(signal: NodeJS.Signals): Promise<void> {
  if (isStopping) {
    return;
  }

  isStopping = true;
  logger.info("Bot to‘xtatilmoqda", { signal });

  const runnerResult = await Promise.allSettled([
    runnerHandle?.stop() ?? Promise.resolve(),
  ]);
  const resourceNames = [
    "notification_worker",
    "redis_producers",
    "prisma",
  ] as const;
  const resourceResults = await Promise.allSettled([
    notificationWorker?.close() ?? Promise.resolve(),
    closeRedisProducers(),
    prisma.$disconnect(),
  ]);
  const failedResources = [
    ...(runnerResult[0].status === "rejected" ? ["telegram_runner"] : []),
    ...resourceResults.flatMap((result, index) =>
      result.status === "rejected" ? [resourceNames[index]] : [],
    ),
  ];

  if (failedResources.length === 0) {
    logger.info("Bot muvaffaqiyatli to‘xtatildi", { signal });
    return;
  }

  logger.error(
    "Botning ayrim resurslarini yopib bo‘lmadi",
    { name: "BotShutdownError" },
    { failedResources, signal },
  );
}

function registerShutdownSignal(signal: NodeJS.Signals): void {
  process.once(signal, () => {
    void stopBot(signal).finally(() => process.exit(0));
  });
}

registerShutdownSignal("SIGINT");
registerShutdownSignal("SIGTERM");

try {
  await bot.init();
  try {
    await configureBotCommandMenu(
      (commands, options) =>
        bot.api.setMyCommands([...commands], options),
      env.ADMIN_TELEGRAM_IDS,
    );
  } catch (error) {
    logger.error("Telegram command menyusini o‘rnatib bo‘lmadi", error);
  }

  if (isShutdownRequested()) {
    logger.info("Bot ishga tushishi shutdown signali sabab bekor qilindi");
  } else {
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
  }
} catch (error) {
  logger.error("Telegram botni ishga tushirib bo‘lmadi", error);
  process.exitCode = 1;
}
