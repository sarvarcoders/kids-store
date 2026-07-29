import assert from "node:assert/strict";
import test from "node:test";

import {
  formatAdminOrderCreated,
  formatCustomerOrderCreated,
  formatOrderConfirmation,
} from "../src/services/order-message.formatter.js";

const orderMessage = {
  orderId: 42,
  productName: "<b>Sport kostyumi</b>",
  size: "104",
  color: "Ko‘k",
  quantity: 2,
  unitPrice: 199_000,
  totalAmount: 398_000,
  phone: "+998901234567",
  deliveryAddress: "Toshkent\nChilonzor, 1-uy",
  status: "PENDING",
  telegramUserId: 123_456n,
  username: "test_user",
} as const;

void test("tasdiqlash oynasi dona va jami narxni ko‘rsatadi", () => {
  const message = formatOrderConfirmation(orderMessage);

  assert.match(message, /Dona narxi: 199 000 so‘m/);
  assert.match(message, /Jami: 398 000 so‘m/);
  assert.match(message, /O‘lcham: 104/);
  assert.match(message, /Rang: Ko‘k/);
});

void test("mijoz tasdiq xabarida order ID va status mavjud", () => {
  const message = formatCustomerOrderCreated(orderMessage);

  assert.match(message, /Buyurtma ID: 42/);
  assert.match(message, /Status: Kutilmoqda/);
  assert.match(message, /Jami: 398 000 so‘m/);
});

void test("admin xabari plain text va bir qatorli tashqi qiymatlardan foydalanadi", () => {
  const message = formatAdminOrderCreated(orderMessage);

  assert.match(message, /Mijoz: @test_user/);
  assert.match(message, /Manzil: Toshkent Chilonzor, 1-uy/);
  assert.match(message, /Mahsulot: <b>Sport kostyumi<\/b>/);
});
