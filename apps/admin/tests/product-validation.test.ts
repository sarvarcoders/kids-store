import assert from "node:assert/strict";
import test from "node:test";

import { adminProductInputSchema } from "@kids-store/shared";

import {
  getProductActivationChange,
  getRemovedVariantStrategy,
  isPrismaUniqueConstraintError,
} from "../src/lib/products/product-domain.js";
import {
  formatOptionalProductIntegerInput,
  formatProductIntegerInput,
  getProductIntegerPreview,
} from "../src/lib/products/product-number-input.js";

const validProduct = {
  code: "KS-0100",
  name: "Bolalar kostyumi",
  slug: "bolalar-kostyumi",
  description: "Yumshoq mato",
  categoryId: 1,
  price: 249_000,
  discountPrice: 199_000,
  isActive: true,
  images: [
    {
      url: "https://placehold.co/800x1000",
      sortOrder: 0,
    },
  ],
  variants: [
    { size: "98", color: "Ko‘k", stock: 5 },
    { size: "104", color: "Ko‘k", stock: 4 },
  ],
};

void test("product create inputini trim va integer narx bilan qabul qiladi", () => {
  const product = adminProductInputSchema.parse({
    ...validProduct,
    code: " KS-0100 ",
    fakePrice: 1,
  });

  assert.equal(product.code, "KS-0100");
  assert.equal(product.price, 249_000);
  assert.equal("fakePrice" in product, false);
});

void test("manfiy narx va duplicate variantni rad etadi", () => {
  assert.equal(
    adminProductInputSchema.safeParse({
      ...validProduct,
      price: -1,
    }).success,
    false,
  );
  assert.equal(
    adminProductInputSchema.safeParse({
      ...validProduct,
      variants: [
        { size: "98", color: "Ko‘k", stock: 5 },
        { size: "98", color: "ko‘k", stock: 2 },
      ],
    }).success,
    false,
  );
});

void test("duplicate code va slug Prisma P2002 sifatida aniqlanadi", () => {
  assert.equal(isPrismaUniqueConstraintError({ code: "P2002" }), true);
  assert.equal(isPrismaUniqueConstraintError({ code: "P2025" }), false);
});

void test("update referenced variantni hard delete qilmaydi", () => {
  assert.equal(
    getRemovedVariantStrategy({ orderItems: 1, cartItems: 0 }),
    "zero_stock",
  );
  assert.equal(
    getRemovedVariantStrategy({ orderItems: 0, cartItems: 0 }),
    "delete",
  );
});

void test("archive bir xil requestda idempotent", () => {
  assert.deepEqual(getProductActivationChange(true, false), {
    action: "product_archived",
    changed: true,
  });
  assert.deepEqual(getProductActivationChange(false, false), {
    action: null,
    changed: false,
  });
});

void test("product slug nom va koddan avtomatik yaratiladi", () => {
  const product = adminProductInputSchema.parse({
    ...validProduct,
    slug: undefined,
  });

  assert.equal(product.slug, "bolalar-kostyumi-ks-0100");
});

void test("yangi product raqam inputi bo‘sh holatda qolishi mumkin", () => {
  assert.equal(formatOptionalProductIntegerInput(null), "");
  assert.equal(getProductIntegerPreview(""), 0);
});

void test("saqlangan narx va stock input matniga xavfsiz o‘tkaziladi", () => {
  assert.equal(formatProductIntegerInput(249_000), "249000");
  assert.equal(formatProductIntegerInput(0), "0");
  assert.equal(getProductIntegerPreview("5"), 5);
});

void test("manfiy, kasr va PostgreSQL integer limitidan katta qiymat rad etiladi", () => {
  assert.throws(() => formatProductIntegerInput(-1));
  assert.throws(() => formatProductIntegerInput(1.5));
  assert.throws(() => formatProductIntegerInput(2_147_483_648));
  assert.equal(getProductIntegerPreview("-1"), 0);
});
