import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { catalogResponseSchema } from "@kids-store/shared/catalog";

import {
  CATALOG_GZIP_BUDGET_BYTES,
  measureCatalogPayload,
} from "../src/lib/catalog/payload-budget.js";

function uniqueText(seed: string, length: number): string {
  let value = "";
  let index = 0;

  while (value.length < length) {
    value += createHash("sha256").update(`${seed}-${String(index)}`).digest("hex");
    index += 1;
  }

  return value.slice(0, length);
}

function createProduct(id: number) {
  return {
    id,
    name: uniqueText(`product-${String(id)}`, 160),
    price: 249_000,
    discountPrice: 199_000,
    categoryName: uniqueText(`category-name-${String(id)}`, 120),
    imageUrl: `https://images.unsplash.com/${uniqueText(`image-${String(id)}`, 1_900)}`,
    availableSizes: Array.from({ length: 12 }, (_, index) =>
      uniqueText(`size-${String(id)}-${String(index)}`, 50),
    ),
  };
}

void test("bounded /api/catalog payload 100KB gzip budgetdan oshmaydi", () => {
  const payload = catalogResponseSchema.parse({
    categories: Array.from({ length: 100 }, (_, index) => ({
      id: index + 1,
      name: uniqueText(`category-${String(index)}`, 120),
      slug: `category-${String(index)}-${uniqueText(`slug-${String(index)}`, 80)}`,
    })),
    products: Array.from({ length: 12 }, (_, index) => createProduct(index + 1)),
    discountProducts: Array.from({ length: 6 }, (_, index) => createProduct(index + 101)),
    user: { id: "123456789", firstName: "Test" },
    pagination: {
      page: 1,
      limit: 12,
      total: 12,
      totalPages: 1,
      hasPreviousPage: false,
      hasNextPage: false,
    },
    cartQuantity: 0,
  });
  const measurement = measureCatalogPayload(payload);

  assert.equal(measurement.withinBudget, true);
  assert.ok(measurement.gzipBytes <= CATALOG_GZIP_BUDGET_BYTES);
});
