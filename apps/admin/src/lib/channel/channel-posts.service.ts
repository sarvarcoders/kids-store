import "server-only";

import {
  ChannelPostServiceError,
  publishChannelProduct,
  type ChannelTelegramGateway,
} from "@kids-store/core";
import { prisma, type Prisma } from "@kids-store/database";
import {
  adminChannelPostQuerySchema,
  type AdminChannelPostQuery,
} from "@kids-store/shared";
import { z } from "zod";

import { appendAdminAuditLog } from "../audit/audit.service";
import { AdminServiceError } from "../errors/admin-service-error";
import { getAdminServerEnv } from "../env/server";

const productIdSchema = z.coerce.number().int().positive();
const adminIdSchema = z.string().regex(/^[1-9]\d*$/);
const telegramMessageSchema = z.object({
  ok: z.literal(true),
  result: z.object({
    message_id: z.number().int().positive(),
    chat: z.object({
      id: z.number().int(),
      username: z.string().optional(),
    }),
  }),
});

function createTelegramGateway(botToken: string): ChannelTelegramGateway {
  const call = async (
    method: "sendMessage" | "sendPhoto",
    body: Record<string, unknown>,
  ) => {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/${method}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        cache: "no-store",
      },
    );
    const payload: unknown = await response.json();
    const parsed = telegramMessageSchema.safeParse(payload);

    if (!response.ok || !parsed.success) {
      throw new Error("TELEGRAM_CHANNEL_REQUEST_FAILED");
    }

    const result = parsed.data.result;

    return {
      message_id: result.message_id,
      chat: {
        id: result.chat.id,
        ...(result.chat.username === undefined
          ? {}
          : { username: result.chat.username }),
      },
    };
  };

  return {
    sendMessage(channelId, text, replyMarkup) {
      return call("sendMessage", {
        chat_id: channelId,
        text,
        reply_markup: replyMarkup,
      });
    },
    sendPhoto(channelId, photoUrl, caption, replyMarkup) {
      return call("sendPhoto", {
        chat_id: channelId,
        photo: photoUrl,
        caption,
        reply_markup: replyMarkup,
      });
    },
  };
}

function parseChannelId(value: string | undefined): bigint | undefined {
  if (!value || !/^-?[1-9]\d{0,18}$/.test(value)) {
    return undefined;
  }

  const parsed = BigInt(value);
  return parsed >= -9_223_372_036_854_775_808n &&
    parsed <= 9_223_372_036_854_775_807n
    ? parsed
    : undefined;
}

function createPostUrl(channelId: bigint, messageId: number): string | null {
  const value = channelId.toString();

  return value.startsWith("-100") && value.length > 4
    ? `https://t.me/c/${value.slice(4)}/${String(messageId)}`
    : null;
}

function getPublishedMessageId(metadata: Prisma.JsonValue): number | null {
  if (
    metadata === null ||
    Array.isArray(metadata) ||
    typeof metadata !== "object"
  ) {
    return null;
  }

  const value = metadata.telegramMessageId;
  return typeof value === "number" && Number.isInteger(value)
    ? value
    : null;
}

export async function listAdminChannelPosts(queryInput: unknown) {
  const query: AdminChannelPostQuery =
    adminChannelPostQuerySchema.parse(queryInput);
  const channelId = parseChannelId(query.channelId);
  const where: Prisma.ChannelPostWhereInput = {
    ...(query.productId ? { productId: query.productId } : {}),
    ...(channelId === undefined
      ? {}
      : { telegramChannelId: channelId }),
    ...(query.dateFrom || query.dateTo
      ? {
          createdAt: {
            ...(query.dateFrom
              ? { gte: new Date(`${query.dateFrom}T00:00:00+05:00`) }
              : {}),
            ...(query.dateTo
              ? { lte: new Date(`${query.dateTo}T23:59:59.999+05:00`) }
              : {}),
          },
        }
      : {}),
  };
  const [total, posts, products] = await Promise.all([
    prisma.channelPost.count({ where }),
    prisma.channelPost.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      select: {
        id: true,
        telegramMessageId: true,
        telegramChannelId: true,
        createdAt: true,
        product: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    }),
    prisma.product.findMany({
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
      },
    }),
  ]);
  const audits =
    posts.length === 0
      ? []
      : await prisma.adminAuditLog.findMany({
          where: {
            action: "product_published",
            entityType: "Product",
            entityId: {
              in: Array.from(
                new Set(
                  posts.map((post) => String(post.product.id)),
                ),
              ),
            },
          },
          orderBy: {
            createdAt: "desc",
          },
          select: {
            adminTelegramId: true,
            metadata: true,
          },
        });
  const publisherByMessageId = new Map<number, string>();

  audits.forEach((audit) => {
    const messageId = getPublishedMessageId(audit.metadata);

    if (
      messageId !== null &&
      !publisherByMessageId.has(messageId)
    ) {
      publisherByMessageId.set(
        messageId,
        audit.adminTelegramId.toString(),
      );
    }
  });

  return {
    data: posts.map((post) => ({
      id: post.id,
      messageId: post.telegramMessageId,
      channelId: post.telegramChannelId.toString(),
      postUrl: createPostUrl(
        post.telegramChannelId,
        post.telegramMessageId,
      ),
      createdAt: post.createdAt.toISOString(),
      product: post.product,
      publishedBy:
        publisherByMessageId.get(post.telegramMessageId) ?? null,
    })),
    products,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
    },
  };
}

export async function publishAdminProduct(
  adminTelegramIdInput: unknown,
  productIdInput: unknown,
) {
  const adminTelegramId = adminIdSchema.parse(adminTelegramIdInput);
  const productId = productIdSchema.parse(productIdInput);
  const env = getAdminServerEnv();

  try {
    const result = await publishChannelProduct(
      {
        productId,
        channelId: env.TELEGRAM_CHANNEL_ID,
        botUsername: env.TELEGRAM_BOT_USERNAME,
      },
      createTelegramGateway(env.TELEGRAM_BOT_TOKEN),
      (error) => {
        console.warn(
          JSON.stringify({
            event: "admin_channel_photo_fallback",
            errorName:
              error instanceof Error ? error.name : "UnknownError",
            productId,
          }),
        );
      },
    );
    await appendAdminAuditLog({
      adminTelegramId,
      action: "product_published",
      entityType: "Product",
      entityId: productId,
      metadata: {
        telegramMessageId: result.telegramMessageId,
        postUrl: result.postUrl,
        sentWithPhoto: result.sentWithPhoto,
      },
    });

    return result;
  } catch (error) {
    if (error instanceof ChannelPostServiceError) {
      throw new AdminServiceError(
        error.code,
        error.message,
        error.code === "PRODUCT_NOT_AVAILABLE" ||
          error.code === "PRODUCT_OUT_OF_STOCK"
          ? 400
          : 409,
        error,
      );
    }

    throw error;
  }
}
