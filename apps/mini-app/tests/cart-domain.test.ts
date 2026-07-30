import assert from "node:assert/strict";
import test from "node:test";

import { addCartItemInputSchema } from "@kids-store/shared";

import {
  CartQuantityError,
  formatCartDto,
  getNextCartQuantity,
  type CartRecord,
} from "../src/lib/cart/cart-domain.js";

const baseCart: CartRecord = {
  id: 1,
  customer: { phone: "+998901234567" },
  items: [
    {
      id: 10,
      quantity: 2,
      productVariant: {
        id: 100,
        size: "98",
        color: "Ko‘k",
        stock: 5,
        product: {
          id: 20,
          code: "KS-0001",
          name: "Sport kostyumi",
          price: 249_000,
          discountPrice: 199_000,
          isActive: true,
          images: [{ url: "https://example.com/product.jpeg" }],
        },
      },
    },
  ],
};

void test("yangi cart item quantitysi server qoidasi bilan hisoblanadi", () => {
  assert.equal(
    getNextCartQuantity({
      currentQuantity: 0,
      requestedQuantity: 2,
      stock: 5,
    }),
    2,
  );
});

void test("bir xil variant takror qo‘shilganda quantity oshadi", () => {
  assert.equal(
    getNextCartQuantity({
      currentQuantity: 2,
      requestedQuantity: 2,
      stock: 5,
    }),
    4,
  );
});

void test("stockdan ko‘p quantity rad etiladi", () => {
  assert.throws(
    () =>
      getNextCartQuantity({
        currentQuantity: 3,
        requestedQuantity: 2,
        stock: 4,
      }),
    (error: unknown) =>
      error instanceof CartQuantityError &&
      error.code === "INSUFFICIENT_STOCK",
  );
});

void test("umumiy quantity 5 dan oshmaydi", () => {
  assert.throws(
    () =>
      getNextCartQuantity({
        currentQuantity: 4,
        requestedQuantity: 2,
        stock: 10,
      }),
    (error: unknown) =>
      error instanceof CartQuantityError &&
      error.code === "QUANTITY_LIMIT",
  );
});

void test("cart DTO narxni databasedagi chegirmadan hisoblaydi", () => {
  const cart = formatCartDto(baseCart);
  const [item] = cart.items;

  assert.ok(item);
  assert.equal(item.unitPrice, 199_000);
  assert.equal(item.subtotal, 398_000);
  assert.equal(cart.totalAmount, 398_000);
  assert.equal(cart.totalQuantity, 2);
});

void test("inactive mahsulot unavailable bo‘lib totalga kirmaydi", () => {
  const cart = formatCartDto({
    ...baseCart,
    items: baseCart.items.map((item) => ({
      ...item,
      productVariant: {
        ...item.productVariant,
        product: {
          ...item.productVariant.product,
          isActive: false,
        },
      },
    })),
  });
  const [item] = cart.items;

  assert.ok(item);
  assert.equal(item.isAvailable, false);
  assert.equal(cart.unavailableItemsCount, 1);
  assert.equal(cart.totalAmount, 0);
});

void test("client yuborgan fake price inputdan olib tashlanadi", () => {
  const input = addCartItemInputSchema.parse({
    productVariantId: 100,
    quantity: 1,
    price: 1,
    total: 1,
  });

  assert.deepEqual(input, {
    productVariantId: 100,
    quantity: 1,
  });
});
