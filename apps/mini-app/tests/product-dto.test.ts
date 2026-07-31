import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import test from "node:test";

import {
  compactProductListItem,
  formatCatalogProduct,
  formatProductDetail,
  formatProductListItem,
  type ProductDetailRecord,
} from "../src/lib/catalog/product-dto.js";

const product: ProductDetailRecord = {
  id: 1,
  code: "KS-0001",
  name: "Bolalar uchun sport kostyumi",
  description: "Yumshoq matoli sport kostyumi.",
  price: 249_000,
  discountPrice: 199_000,
  category: {
    id: 1,
    name: "O‘g‘il bolalar kiyimi",
    slug: "boys-clothing",
  },
  images: [
    {
      id: 2,
      url: "https://placehold.co/1200x1200/png?text=Ikkinchi",
      sortOrder: 1,
    },
    {
      id: 1,
      url: "https://placehold.co/1200x1200/png?text=Birinchi",
      sortOrder: 0,
    },
  ],
  variants: [
    { id: 1, size: "98", color: "Ko‘k", stock: 5 },
    { id: 2, size: "98", color: "Qora", stock: 2 },
    { id: 3, size: "104", color: "Ko‘k", stock: 4 },
    { id: 4, size: "110", color: "Qora", stock: 0 },
  ],
};

void test("product list DTO faqat kerakli maydon va unique size qaytaradi", () => {
  const dto = formatProductListItem(product);

  assert.equal(dto.id, 1);
  assert.equal("description" in dto, false);
  assert.deepEqual(dto.availableSizes, ["98", "104"]);
  assert.equal(dto.primaryImage?.id, 2);
});

void test("product detail DTO stocki tugagan variantni chiqarmaydi", () => {
  const dto = formatProductDetail(product);

  assert.equal(dto.variants.length, 3);
  assert.equal(dto.variants.some((variant) => variant.stock === 0), false);
  assert.equal(dto.images.length, 2);
  assert.equal(dto.category.slug, "boys-clothing");
});

void test("catalog DTO nested va null maydonlarni payloadga chiqarmaydi", () => {
  const compact = formatCatalogProduct(product);
  const legacy = formatProductListItem(product);

  assert.equal(compact.categoryName, product.category.name);
  assert.equal(compact.imageUrl, product.images[0]?.url);
  assert.equal("category" in compact, false);
  assert.equal("primaryImage" in compact, false);
  assert.ok(JSON.stringify(compact).length < JSON.stringify(legacy).length);

  const withoutOptionalFields = formatCatalogProduct({
    ...product,
    discountPrice: null,
    images: [],
  });

  assert.equal("discountPrice" in withoutOptionalFields, false);
  assert.equal("imageUrl" in withoutOptionalFields, false);
});

void test("legacy filter javobi compact catalog DTOga o‘tkaziladi", () => {
  const compact = compactProductListItem(formatProductListItem(product));

  assert.deepEqual(compact.availableSizes, ["98", "104"]);
  assert.equal(compact.categoryName, product.category.name);
});

void test("1000 ta catalog DTO formatlash lokal performance budjetida qoladi", () => {
  const startedAt = performance.now();

  for (let index = 0; index < 1_000; index += 1) {
    formatCatalogProduct({
      ...product,
      id: index + 1,
    });
  }

  assert.ok(performance.now() - startedAt < 1_000);
});
