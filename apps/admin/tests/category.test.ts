import assert from "node:assert/strict";
import test from "node:test";

import {
  adminCategoryInputSchema,
  createCategorySlug,
} from "@kids-store/shared";

import { canHardDeleteCategory } from "../src/lib/categories/category-domain.js";

void test("category name va slugni validatsiya qiladi", () => {
  assert.deepEqual(
    adminCategoryInputSchema.parse({
      name: " O‘g‘il bolalar ",
      slug: "boys-clothing",
    }),
    {
      name: "O‘g‘il bolalar",
      slug: "boys-clothing",
    },
  );
  assert.equal(
    adminCategoryInputSchema.safeParse({
      name: "Test",
      slug: "Noto‘g‘ri Slug",
    }).success,
    false,
  );
});

void test("category slug nomdan avtomatik yaratiladi", () => {
  assert.deepEqual(
    adminCategoryInputSchema.parse({ name: "Qiz bolalar kiyimi" }),
    {
      name: "Qiz bolalar kiyimi",
      slug: "qiz-bolalar-kiyimi",
    },
  );
  assert.equal(
    createCategorySlug("Sumka va aksessuarlar"),
    "sumka-va-aksessuarlar",
  );
});

void test("bog‘langan category hard delete qilinmaydi", () => {
  assert.equal(canHardDeleteCategory(3), false);
  assert.equal(canHardDeleteCategory(0), true);
});
