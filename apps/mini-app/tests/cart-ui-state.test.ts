import assert from "node:assert/strict";
import test from "node:test";

import type { CartDto } from "@kids-store/shared";

import {
  clearCartOptimistically,
  removeCartItemOptimistically,
  updateCartQuantityOptimistically,
} from "../src/lib/cart/cart-ui-state.js";

const cart: CartDto = {
  id: 1,
  customerPhone: null,
  totalQuantity: 1,
  totalAmount: 199_000,
  unavailableItemsCount: 0,
  items: [
    {
      id: 10,
      productId: 1,
      productCode: "KS-0001",
      productName: "Sport kostyumi",
      productImage: null,
      variantId: 100,
      size: "98",
      color: "Ko‘k",
      stock: 5,
      quantity: 1,
      unitPrice: 199_000,
      subtotal: 199_000,
      isAvailable: true,
    },
  ],
};

void test("optimistic quantity cart badge va totalni yangilaydi", () => {
  const optimistic = updateCartQuantityOptimistically(
    cart,
    10,
    2,
  );

  assert.equal(optimistic.totalQuantity, 2);
  assert.equal(optimistic.totalAmount, 398_000);
  assert.equal(cart.totalQuantity, 1);
});

void test("optimistic xatoda oldingi immutable cart rollback uchun saqlanadi", () => {
  const optimistic = removeCartItemOptimistically(cart, 10);

  assert.equal(optimistic.items.length, 0);
  assert.equal(cart.items.length, 1);
  assert.equal(cart.totalAmount, 199_000);
});

void test("clear optimistic state empty cart qaytaradi", () => {
  const empty = clearCartOptimistically(cart);

  assert.equal(empty.items.length, 0);
  assert.equal(empty.totalQuantity, 0);
  assert.equal(empty.totalAmount, 0);
});
