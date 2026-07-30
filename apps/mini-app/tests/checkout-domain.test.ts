import assert from "node:assert/strict";
import test from "node:test";

import { checkoutInputSchema } from "@kids-store/shared";

import {
  buildCheckoutPlan,
  CheckoutPlanError,
} from "../src/lib/checkout/checkout-domain.js";

const checkoutItems = [
  {
    quantity: 2,
    productVariant: {
      id: 10,
      stock: 3,
      product: {
        price: 249_000,
        discountPrice: 199_000,
        isActive: true,
      },
    },
  },
];

void test("bo‘sh cart checkout qilinmaydi", () => {
  assert.throws(
    () => buildCheckoutPlan([]),
    (error: unknown) =>
      error instanceof CheckoutPlanError &&
      error.code === "EMPTY_CART",
  );
});

void test("valid checkout narx va totalni server qiymatidan hisoblaydi", () => {
  const plan = buildCheckoutPlan(checkoutItems);
  const [item] = plan.orderItems;

  assert.ok(item);
  assert.equal(item.unitPrice, 199_000);
  assert.equal(item.subtotal, 398_000);
  assert.equal(plan.totalAmount, 398_000);
});

void test("checkout paytida stock yetarli bo‘lmasa rad etiladi", () => {
  assert.throws(
    () =>
      buildCheckoutPlan([
        {
          ...checkoutItems[0],
          quantity: 4,
        },
      ]),
    (error: unknown) =>
      error instanceof CheckoutPlanError &&
      error.code === "INSUFFICIENT_STOCK",
  );
});

void test("inactive item checkoutni to‘xtatadi", () => {
  assert.throws(
    () =>
      buildCheckoutPlan([
        {
          quantity: 1,
          productVariant: {
            id: 10,
            stock: 3,
            product: {
              price: 249_000,
              discountPrice: null,
              isActive: false,
            },
          },
        },
      ]),
    (error: unknown) =>
      error instanceof CheckoutPlanError &&
      error.code === "UNAVAILABLE_ITEM",
  );
});

void test("checkout input client price va customerIdni qabul qilmaydi", () => {
  const input = checkoutInputSchema.parse({
    phone: "+998901234567",
    deliveryAddress: "Toshkent shahri, Chilonzor tumani",
    idempotencyKey: "1ecb8c91-e320-4a5d-90ee-1a85cb6726bd",
    customerId: 999,
    totalAmount: 1,
  });

  assert.equal("customerId" in input, false);
  assert.equal("totalAmount" in input, false);
});
