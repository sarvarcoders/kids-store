import assert from "node:assert/strict";
import test from "node:test";

import { productQuerySchema } from "@kids-store/shared";

void test("product query filterlarini normalizatsiya qiladi", () => {
  const query = productQuerySchema.parse({
    category: "boys-clothing",
    search: "  sport  ",
    discountOnly: "true",
    page: "2",
    limit: "6",
  });

  assert.deepEqual(query, {
    category: "boys-clothing",
    search: "sport",
    discountOnly: true,
    page: 2,
    limit: 6,
  });
});

void test("bo‘sh optional filterlar default qiymatlarni oladi", () => {
  const query = productQuerySchema.parse({
    category: "",
    search: "",
  });

  assert.equal(query.category, undefined);
  assert.equal(query.search, undefined);
  assert.equal(query.discountOnly, false);
  assert.equal(query.page, 1);
  assert.equal(query.limit, 12);
});

void test("juda uzun search va limitni rad etadi", () => {
  assert.equal(
    productQuerySchema.safeParse({
      search: "a".repeat(81),
    }).success,
    false,
  );
  assert.equal(
    productQuerySchema.safeParse({
      limit: "25",
    }).success,
    false,
  );
  assert.equal(
    productQuerySchema.safeParse({
      search: "a",
    }).success,
    false,
  );
});
