import assert from "node:assert/strict";
import test from "node:test";

import {
  formatAdminOrderNotification,
  formatCustomerOrderNotification,
} from "@kids-store/shared";

const notification = {
  orderId: 100,
  status: "PENDING",
  totalAmount: 398_000,
  phone: "+998901234567",
  deliveryAddress: "Toshkent shahri, Chilonzor tumani",
  telegramUserId: "123456789",
  username: "test_user",
  items: [
    {
      productName: "Sport kostyumi",
      size: "98",
      color: "Ko‘k",
      quantity: 2,
      unitPrice: 199_000,
    },
  ],
};

void test("customer notification checkout ma’lumotlarini ko‘rsatadi", () => {
  const message = formatCustomerOrderNotification(notification);

  assert.match(message, /Buyurtma ID: 100/);
  assert.match(message, /Sport kostyumi/);
  assert.match(message, /Telefon: \+998901234567/);
  assert.match(message, /Manzil: Toshkent/);
});

void test("admin notification plain text identifikatorni ko‘rsatadi", () => {
  const message = formatAdminOrderNotification(notification);

  assert.match(message, /@test_user/);
  assert.match(message, /Telegram ID: 123456789/);
  assert.equal(message.includes("<b>"), false);
});
