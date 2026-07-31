import assert from "node:assert/strict";
import test from "node:test";

import type { CatalogProductDto } from "@kids-store/shared/catalog";
import { isValidElement } from "react";

import { ProductCard } from "../src/components/catalog/product-card.js";

void test("product card Supabase Storage rasmini va sotuv ma’lumotini render qiladi", () => {
  const product: CatalogProductDto = {
    id: 41,
    name: "Bolalar sport kostyumi",
    price: 249_000,
    discountPrice: 199_000,
    categoryName: "O‘g‘il bolalar kiyimi",
    imageUrl:
      "https://example-project.supabase.co/storage/v1/object/public/product-images/products/41/image.webp",
    availableSizes: ["98", "104"],
  };
  const card = ProductCard({ product });
  const serialized = JSON.stringify(card, (key, value: unknown) =>
    ["$$typeof", "_owner", "type"].includes(key) ? undefined : value,
  );

  assert.equal(isValidElement(card), true);
  assert.match(serialized, /Bolalar sport kostyumi/);
  assert.match(serialized, /example-project\.supabase\.co/);
  assert.match(serialized, /\/products\/41/);
  assert.match(serialized, /199/);
});
