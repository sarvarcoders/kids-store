import { prisma } from "@kids-store/database";
import type { Api } from "grammy";

import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { databaseIdSchema } from "../config/validation.js";
import { createChannelPurchaseKeyboard } from "../keyboards/channel-post.keyboard.js";
import {
  buildProductDeepLink,
  formatChannelPhotoCaption,
  formatChannelTextPost,
} from "./channel-post.formatter.js";

export type ChannelPostErrorCode =
  | "PRODUCT_NOT_AVAILABLE"
  | "TELEGRAM_SEND_FAILED"
  | "DATABASE_WRITE_FAILED";

const channelPostErrorMessages: Record<ChannelPostErrorCode, string> = {
  PRODUCT_NOT_AVAILABLE: "Mahsulot topilmadi yoki faol emas.",
  TELEGRAM_SEND_FAILED: "Kanalga post yuborib bo‘lmadi.",
  DATABASE_WRITE_FAILED: "Kanal posti database’ga yozilmadi.",
};

export class ChannelPostServiceError extends Error {
  readonly code: ChannelPostErrorCode;

  constructor(code: ChannelPostErrorCode, cause?: unknown) {
    super(channelPostErrorMessages[code], cause === undefined ? undefined : { cause });
    this.name = "ChannelPostServiceError";
    this.code = code;
  }
}

interface SentChannelMessage {
  message_id: number;
  chat: {
    id: number;
    username?: string | undefined;
  };
}

export interface PublishedChannelPost {
  productId: number;
  productName: string;
  telegramMessageId: number;
  postUrl: string | null;
  sentWithPhoto: boolean;
}

function createChannelPostUrl(message: SentChannelMessage): string | null {
  const channelUsername = message.chat.username?.trim();

  if (channelUsername) {
    return `https://t.me/${channelUsername}/${String(message.message_id)}`;
  }

  const channelId = String(message.chat.id);

  if (!channelId.startsWith("-100") || channelId.length <= 4) {
    return null;
  }

  return `https://t.me/c/${channelId.slice(4)}/${String(message.message_id)}`;
}

export class ChannelPostService {
  constructor(private readonly telegramApi: Api) {}

  async publishProduct(productIdInput: unknown): Promise<PublishedChannelPost> {
    const productId = databaseIdSchema.parse(productIdInput);

    const product = await prisma.product.findFirst({
      where: {
        id: productId,
        isActive: true,
      },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        price: true,
        discountPrice: true,
        category: {
          select: {
            name: true,
          },
        },
        images: {
          select: {
            url: true,
            sortOrder: true,
          },
          orderBy: {
            sortOrder: "asc",
          },
        },
        variants: {
          where: {
            stock: {
              gt: 0,
            },
          },
          select: {
            size: true,
            color: true,
            stock: true,
          },
          orderBy: [{ size: "asc" }, { color: "asc" }],
        },
      },
    });

    if (!product) {
      throw new ChannelPostServiceError("PRODUCT_NOT_AVAILABLE");
    }

    const deepLink = buildProductDeepLink(env.TELEGRAM_BOT_USERNAME, product.id);
    const replyMarkup = createChannelPurchaseKeyboard(deepLink);
    const channelId = env.TELEGRAM_CHANNEL_ID;
    const primaryImage = product.images[0];
    let sentMessage: SentChannelMessage;
    let sentWithPhoto = false;

    if (primaryImage) {
      try {
        sentMessage = await this.telegramApi.sendPhoto(
          channelId,
          primaryImage.url,
          {
            caption: formatChannelPhotoCaption(product),
            reply_markup: replyMarkup,
          },
        );
        sentWithPhoto = true;
      } catch (error) {
        logger.warn("Kanalga mahsulot rasmini yuborib bo‘lmadi, text fallback ishlatiladi", {
          productId: product.id,
          errorName: error instanceof Error ? error.name : "UnknownError",
        });
        sentMessage = await this.sendTextFallback(
          channelId,
          product,
          replyMarkup,
        );
      }
    } else {
      sentMessage = await this.sendTextFallback(
        channelId,
        product,
        replyMarkup,
      );
    }

    try {
      await prisma.channelPost.create({
        data: {
          telegramMessageId: sentMessage.message_id,
          telegramChannelId: BigInt(sentMessage.chat.id),
          productId: product.id,
        },
      });
    } catch (error) {
      logger.error("Kanal postini database’ga yozishda xato", error, {
        productId: product.id,
        telegramMessageId: sentMessage.message_id,
      });
      throw new ChannelPostServiceError("DATABASE_WRITE_FAILED", error);
    }

    return {
      productId: product.id,
      productName: product.name,
      telegramMessageId: sentMessage.message_id,
      postUrl: createChannelPostUrl(sentMessage),
      sentWithPhoto,
    };
  }

  private async sendTextFallback(
    channelId: string,
    product: Parameters<typeof formatChannelTextPost>[0],
    replyMarkup: ReturnType<typeof createChannelPurchaseKeyboard>,
  ): Promise<SentChannelMessage> {
    try {
      return await this.telegramApi.sendMessage(
        channelId,
        formatChannelTextPost(product),
        {
          reply_markup: replyMarkup,
        },
      );
    } catch (error) {
      logger.error("Kanalga text post yuborishda xato", error);
      throw new ChannelPostServiceError("TELEGRAM_SEND_FAILED", error);
    }
  }
}
