import assert from "node:assert/strict";
import test from "node:test";

import {
  ChannelPostServiceError,
  publishChannelProduct,
  type ChannelPostProductRecord,
  type ChannelPostRepository,
  type ChannelTelegramGateway,
} from "../src/index.js";

const product: ChannelPostProductRecord = {
  id: 1,
  code: "KS-0001",
  name: "Sport kostyumi",
  description: "Qulay kiyim",
  price: 249_000,
  discountPrice: 199_000,
  category: {
    name: "Bolalar kiyimi",
  },
  images: [],
  variants: [{ size: "98", color: "Ko‘k", stock: 5 }],
};

function createRepository(
  foundProduct: ChannelPostProductRecord | null,
) {
  const writes: unknown[] = [];
  const repository: ChannelPostRepository = {
    findActiveProduct: () => Promise.resolve(foundProduct),
    createChannelPost(input) {
      writes.push(input);
      return Promise.resolve();
    },
  };

  return { repository, writes };
}

const telegram: ChannelTelegramGateway = {
  sendMessage: () =>
    Promise.resolve({
      message_id: 77,
      chat: {
        id: -1001234567890,
      },
    }),
  sendPhoto: () =>
    Promise.resolve({
      message_id: 77,
      chat: {
        id: -1001234567890,
      },
    }),
};

void test("active va stockli productni publish qilib ChannelPost yozadi", async () => {
  const { repository, writes } = createRepository(product);
  const result = await publishChannelProduct(
    {
      productId: 1,
      channelId: "-1001234567890",
      botUsername: "kids_store_bot",
    },
    telegram,
    undefined,
    repository,
  );

  assert.equal(result.telegramMessageId, 77);
  assert.equal(writes.length, 1);
});

void test("inactive/topilmagan productni publish qilmaydi", async () => {
  const { repository } = createRepository(null);

  await assert.rejects(
    () =>
      publishChannelProduct(
        {
          productId: 1,
          channelId: "-1001234567890",
          botUsername: "kids_store_bot",
        },
        telegram,
        undefined,
        repository,
      ),
    (error) =>
      error instanceof ChannelPostServiceError &&
      error.code === "PRODUCT_NOT_AVAILABLE",
  );
});

void test("stocksiz productni publish qilmaydi", async () => {
  const { repository } = createRepository({
    ...product,
    variants: [],
  });

  await assert.rejects(
    () =>
      publishChannelProduct(
        {
          productId: 1,
          channelId: "-1001234567890",
          botUsername: "kids_store_bot",
        },
        telegram,
        undefined,
        repository,
      ),
    (error) =>
      error instanceof ChannelPostServiceError &&
      error.code === "PRODUCT_OUT_OF_STOCK",
  );
});

void test("Telegram text failure xavfsiz service xatosini qaytaradi", async () => {
  const { repository } = createRepository(product);
  const failingTelegram: ChannelTelegramGateway = {
    ...telegram,
    sendMessage: () => Promise.reject(new Error("unavailable")),
  };

  await assert.rejects(
    () =>
      publishChannelProduct(
        {
          productId: 1,
          channelId: "-1001234567890",
          botUsername: "kids_store_bot",
        },
        failingTelegram,
        undefined,
        repository,
      ),
    (error) =>
      error instanceof ChannelPostServiceError &&
      error.code === "TELEGRAM_SEND_FAILED",
  );
});
