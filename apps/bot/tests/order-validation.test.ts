import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import {
  addressSchema,
  createOrderSchema,
  orderQuantitySchema,
  phoneSchema,
} from "@kids-store/shared";

void test("O‘zbekiston telefon raqamini normal formatga keltiradi", () => {
  assert.equal(phoneSchema.parse("90 123 45 67"), "+998901234567");
  assert.equal(phoneSchema.parse("998901234567"), "+998901234567");
  assert.equal(phoneSchema.parse("+998 (90) 123-45-67"), "+998901234567");
});

void test("noto‘g‘ri telefon va manzilni rad etadi", () => {
  assert.equal(phoneSchema.safeParse("+123456789").success, false);
  assert.equal(addressSchema.safeParse("   ").success, false);
  assert.equal(addressSchema.safeParse("1234").success, false);
  assert.equal(addressSchema.safeParse("A".repeat(501)).success, false);
});

void test("miqdor faqat 1 dan 5 gacha bo‘lishi mumkin", () => {
  assert.equal(orderQuantitySchema.parse("1"), 1);
  assert.equal(orderQuantitySchema.parse(5), 5);
  assert.equal(orderQuantitySchema.safeParse(0).success, false);
  assert.equal(orderQuantitySchema.safeParse(6).success, false);
});

void test("customer va order inputini birgalikda tekshiradi", () => {
  const order = createOrderSchema.parse({
    productVariantId: "10",
    quantity: "2",
    deliveryAddress: "Toshkent shahri, 1-uy",
    idempotencyKey: randomUUID(),
    customer: {
      telegramUserId: "123456",
      username: "test_user",
      firstName: "Test",
      phone: "901234567",
    },
  });

  assert.equal(order.productVariantId, 10);
  assert.equal(order.quantity, 2);
  assert.equal(order.customer.telegramUserId, 123_456n);
  assert.equal(order.customer.phone, "+998901234567");
});
