import assert from "node:assert/strict";
import test from "node:test";

import {
  findSelectedProductVariant,
  getAvailableColorsForSize,
  getMaximumSelectableQuantity,
} from "../src/lib/catalog/product-selection.js";

const variants = [
  { id: 1, size: "98", color: "Ko‘k", stock: 5 },
  { id: 2, size: "98", color: "Qora", stock: 2 },
  { id: 3, size: "104", color: "Ko‘k", stock: 4 },
];

void test("size bo‘yicha faqat mos ranglar qaytariladi", () => {
  assert.deepEqual(
    getAvailableColorsForSize(variants, "98"),
    ["Ko‘k", "Qora"],
  );
});

void test("size va color aniq variantni aniqlaydi", () => {
  const variant = findSelectedProductVariant(variants, {
    size: "98",
    color: "Qora",
  });

  assert.equal(variant?.id, 2);
});

void test("quantity stock va 5 limitidan oshmaydi", () => {
  assert.equal(getMaximumSelectableQuantity(2), 2);
  assert.equal(getMaximumSelectableQuantity(10), 5);
  assert.throws(() => getMaximumSelectableQuantity(0));
});
