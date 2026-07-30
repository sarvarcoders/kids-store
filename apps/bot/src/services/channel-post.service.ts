import {
  ChannelPostServiceError,
  publishChannelProduct,
  type ChannelPostErrorCode,
  type ChannelTelegramGateway,
  type PublishedChannelPost,
} from "@kids-store/core";
import type { Api } from "grammy";

import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { databaseIdSchema } from "../config/validation.js";

function createTelegramGateway(api: Api): ChannelTelegramGateway {
  return {
    async sendMessage(channelId, text, replyMarkup) {
      const message = await api.sendMessage(channelId, text, {
        reply_markup: replyMarkup,
      });
      const username =
        "username" in message.chat ? message.chat.username : undefined;

      return {
        message_id: message.message_id,
        chat: {
          id: message.chat.id,
          ...(username === undefined ? {} : { username }),
        },
      };
    },
    async sendPhoto(channelId, photoUrl, caption, replyMarkup) {
      const message = await api.sendPhoto(channelId, photoUrl, {
        caption,
        reply_markup: replyMarkup,
      });
      const username =
        "username" in message.chat ? message.chat.username : undefined;

      return {
        message_id: message.message_id,
        chat: {
          id: message.chat.id,
          ...(username === undefined ? {} : { username }),
        },
      };
    },
  };
}

export class ChannelPostService {
  constructor(private readonly telegramApi: Api) {}

  async publishProduct(
    productIdInput: unknown,
  ): Promise<PublishedChannelPost> {
    const productId = databaseIdSchema.parse(productIdInput);

    return publishChannelProduct(
      {
        botUsername: env.TELEGRAM_BOT_USERNAME,
        channelId: env.TELEGRAM_CHANNEL_ID,
        productId,
      },
      createTelegramGateway(this.telegramApi),
      (error) => {
        logger.warn(
          "Kanalga mahsulot rasmini yuborib bo‘lmadi, text fallback ishlatiladi",
          {
            errorName:
              error instanceof Error ? error.name : "UnknownError",
          },
        );
      },
    );
  }
}

export {
  ChannelPostServiceError,
  type ChannelPostErrorCode,
  type PublishedChannelPost,
};
