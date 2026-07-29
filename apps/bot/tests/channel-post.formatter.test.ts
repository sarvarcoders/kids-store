import assert from "node:assert/strict";
import test from "node:test";

import {
  TELEGRAM_PHOTO_CAPTION_LIMIT,
  TELEGRAM_TEXT_MESSAGE_LIMIT,
  buildProductDeepLink,
  formatChannelPhotoCaption,
  formatChannelTextPost,
  formatChannelPrice,
} from "../src/services/channel-post.formatter.js";
import type { ChannelPostProduct } from "../src/services/channel-post.formatter.js";

const product: ChannelPostProduct = {
  id: 1,
  code: "KS-0001",
  name: "Bolalar uchun sport kostyumi",
  description:
    "Yumshoq matoli, kundalik kiyish uchun qulay bolalar sport kostyumi.",
  price: 249_000,
  discountPrice: 199_000,
  category: {
    name: "O‘g‘il bolalar kiyimi",
  },
  variants: [
    { size: "98", color: "Ko‘k", stock: 5 },
    { size: "98", color: "Ko‘k", stock: 2 },
    { size: "104", color: "Ko‘k", stock: 4 },
    { size: "110", color: "Qora", stock: 3 },
    { size: "116", color: "Qora", stock: 0 },
  ],
};

void test("narxni so‘m formatida chiqaradi", () => {
  assert.equal(formatChannelPrice(249_000), "249 000 so‘m");
});

void test("caption faqat mavjud va unique o‘lcham hamda ranglarni ko‘rsatadi", () => {
  const caption = formatChannelPhotoCaption(product);

  assert.match(caption, /Eski narxi: 249 000 so‘m/);
  assert.match(caption, /Chegirmali narxi: 199 000 so‘m/);
  assert.match(caption, /Mavjud o‘lchamlar: 98, 104, 110/);
  assert.match(caption, /Mavjud ranglar: Ko‘k, Qora/);
  assert.doesNotMatch(caption, /116/);
  assert.equal(caption.match(/Ko‘k/g)?.length, 1);
  assert.ok(caption.length <= TELEGRAM_PHOTO_CAPTION_LIMIT);
});

void test("uzun tavsifni caption limitida xavfsiz qisqartiradi", () => {
  const caption = formatChannelPhotoCaption({
    ...product,
    description: "A".repeat(5_000),
  });

  assert.ok(caption.length <= TELEGRAM_PHOTO_CAPTION_LIMIT);
  assert.match(caption, /Yetkazib berish/);
  assert.ok(caption.endsWith("…"));
});

void test("text fallback Telegram message limitidan oshmaydi", () => {
  const textPost = formatChannelTextPost({
    ...product,
    description: "B".repeat(10_000),
  });

  assert.ok(textPost.length <= TELEGRAM_TEXT_MESSAGE_LIMIT);
});

void test("product deep linkni to‘g‘ri yaratadi", () => {
  assert.equal(
    buildProductDeepLink("@kids_store_bot", 1),
    "https://t.me/kids_store_bot?start=product_1",
  );
});
