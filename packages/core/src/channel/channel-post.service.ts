import { z } from "zod";

import {
  buildProductDeepLink,
  formatChannelPhotoCaption,
  formatChannelTextPost,
  type ChannelPostProduct,
} from "./channel-post.formatter.js";

const databaseIdSchema = z.coerce
  .number()
  .int()
  .positive()
  .max(2_147_483_647);
const channelIdSchema = z.string().trim().min(1).max(100);
const botUsernameSchema = z.string().trim().min(1).max(64);

interface SentChannelMessage {
  message_id: number;
  chat: {
    id: number;
    username?: string;
  };
}

interface InlineKeyboardMarkup {
  inline_keyboard: {
    text: string;
    url: string;
  }[][];
}

export interface ChannelTelegramGateway {
  sendMessage(
    channelId: string,
    text: string,
    replyMarkup: InlineKeyboardMarkup,
  ): Promise<SentChannelMessage>;
  sendPhoto(
    channelId: string,
    photoUrl: string,
    caption: string,
    replyMarkup: InlineKeyboardMarkup,
  ): Promise<SentChannelMessage>;
}

export interface ChannelPostProductRecord extends ChannelPostProduct {
  images: {
    url: string;
  }[];
}

export interface ChannelPostRepository {
  createChannelPost(input: {
    productId: number;
    telegramChannelId: bigint;
    telegramMessageId: number;
  }): Promise<void>;
  findActiveProduct(
    productId: number,
  ): Promise<ChannelPostProductRecord | null>;
}

export type ChannelPostErrorCode =
  | "PRODUCT_NOT_AVAILABLE"
  | "PRODUCT_OUT_OF_STOCK"
  | "TELEGRAM_SEND_FAILED"
  | "DATABASE_WRITE_FAILED";

const errorMessages: Record<ChannelPostErrorCode, string> = {
  PRODUCT_NOT_AVAILABLE: "Mahsulot topilmadi yoki faol emas.",
  PRODUCT_OUT_OF_STOCK: "Mahsulotning sotuvdagi varianti qolmagan.",
  TELEGRAM_SEND_FAILED: "Kanalga post yuborib bo‘lmadi.",
  DATABASE_WRITE_FAILED: "Kanal posti database’ga yozilmadi.",
};

export class ChannelPostServiceError extends Error {
  readonly code: ChannelPostErrorCode;

  constructor(code: ChannelPostErrorCode, cause?: unknown) {
    super(
      errorMessages[code],
      cause === undefined ? undefined : { cause },
    );
    this.name = "ChannelPostServiceError";
    this.code = code;
  }
}

export interface PublishedChannelPost {
  productId: number;
  productName: string;
  telegramMessageId: number;
  postUrl: string | null;
  sentWithPhoto: boolean;
}

interface PublishChannelProductInput {
  botUsername: string;
  channelId: string;
  productId: number;
}

const prismaChannelPostRepository: ChannelPostRepository = {
  async findActiveProduct(productId) {
    const { prisma } = await import("@kids-store/database");

    return prisma.product.findFirst({
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
  },
  async createChannelPost(input) {
    const { prisma } = await import("@kids-store/database");

    await prisma.channelPost.create({
      data: input,
    });
  },
};

function createPostUrl(message: SentChannelMessage): string | null {
  const username = message.chat.username?.trim();

  if (username) {
    return `https://t.me/${username}/${String(message.message_id)}`;
  }

  const channelId = String(message.chat.id);

  return channelId.startsWith("-100") && channelId.length > 4
    ? `https://t.me/c/${channelId.slice(4)}/${String(message.message_id)}`
    : null;
}

function createPurchaseKeyboard(url: string): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        {
          text: "🛍 Sotib olish",
          url,
        },
      ],
    ],
  };
}

export async function publishChannelProduct(
  input: PublishChannelProductInput,
  telegram: ChannelTelegramGateway,
  onPhotoFallback?: (error: unknown) => void,
  repository: ChannelPostRepository = prismaChannelPostRepository,
): Promise<PublishedChannelPost> {
  const productId = databaseIdSchema.parse(input.productId);
  const channelId = channelIdSchema.parse(input.channelId);
  const botUsername = botUsernameSchema.parse(input.botUsername);
  const product = await repository.findActiveProduct(productId);

  if (!product) {
    throw new ChannelPostServiceError("PRODUCT_NOT_AVAILABLE");
  }

  if (product.variants.length === 0) {
    throw new ChannelPostServiceError("PRODUCT_OUT_OF_STOCK");
  }

  const deepLink = buildProductDeepLink(botUsername, product.id);
  const keyboard = createPurchaseKeyboard(deepLink);
  const primaryImage = product.images[0];
  let message: SentChannelMessage;
  let sentWithPhoto = false;

  if (primaryImage) {
    try {
      message = await telegram.sendPhoto(
        channelId,
        primaryImage.url,
        formatChannelPhotoCaption(product),
        keyboard,
      );
      sentWithPhoto = true;
    } catch (error) {
      onPhotoFallback?.(error);

      try {
        message = await telegram.sendMessage(
          channelId,
          formatChannelTextPost(product),
          keyboard,
        );
      } catch (fallbackError) {
        throw new ChannelPostServiceError(
          "TELEGRAM_SEND_FAILED",
          fallbackError,
        );
      }
    }
  } else {
    try {
      message = await telegram.sendMessage(
        channelId,
        formatChannelTextPost(product),
        keyboard,
      );
    } catch (error) {
      throw new ChannelPostServiceError("TELEGRAM_SEND_FAILED", error);
    }
  }

  try {
    await repository.createChannelPost({
      telegramMessageId: message.message_id,
      telegramChannelId: BigInt(message.chat.id),
      productId: product.id,
    });
  } catch (error) {
    throw new ChannelPostServiceError("DATABASE_WRITE_FAILED", error);
  }

  return {
    productId: product.id,
    productName: product.name,
    telegramMessageId: message.message_id,
    postUrl: createPostUrl(message),
    sentWithPhoto,
  };
}
