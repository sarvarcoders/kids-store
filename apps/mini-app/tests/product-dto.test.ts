import assert from "node:assert/strict";
import test from "node:test";

import {
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
