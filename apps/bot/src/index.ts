import { Bot, session } from "grammy";

import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { registerAdminHandler } from "./handlers/admin.handler.js";
import { registerCallbackHandlers } from "./handlers/callback.handler.js";
import { registerOrderHandlers } from "./handlers/order.handler.js";
import { registerPublishHandler } from "./handlers/publish.handler.js";
import { registerStartHandler } from "./handlers/start.handler.js";
import { ChannelPostService } from "./services/channel-post.service.js";
import { OrderService } from "./services/order.service.js";
import {
  createInitialSession,
  type BotContext,
} from "./types/bot-context.js";

const bot = new Bot<BotContext>(env.TELEGRAM_BOT_TOKEN);

bot.use(
  session({
    initial: createInitialSession,
    getSessionKey: (ctx) => ctx.from?.id.toString(),
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

async function stopBot(signal: NodeJS.Signals): Promise<void> {
  if (isStopping) {
    return;
  }

  isStopping = true;
  logger.info("Bot to‘xtatilmoqda", { signal });

  try {
    await bot.stop();
    logger.info("Bot muvaffaqiyatli to‘xtatildi", { signal });
  } catch (error) {
    logger.error("Botni to‘xtatishda xato yuz berdi", error, { signal });
  }
}

process.once("SIGINT", () => void stopBot("SIGINT"));
process.once("SIGTERM", () => void stopBot("SIGTERM"));

try {
  await bot.start({
    onStart: ({ username }) => {
      logger.info("Telegram bot ishga tushdi", { username });
    },
  });
} catch (error) {
  logger.error("Telegram botni ishga tushirib bo‘lmadi", error);
  process.exitCode = 1;
}
