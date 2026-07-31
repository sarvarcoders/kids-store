import assert from "node:assert/strict";
import test from "node:test";

import {
  nonNegativeIntegerInputSchema,
  parseNumericInputValue,
} from "../src/lib/forms/numeric-input.js";

void test("sonli input tozalanganda bo‘sh holat saqlanadi", () => {
  assert.equal(parseNumericInputValue(""), "");
});

void test("sonli input kiritilgan qiymatni songa aylantiradi", () => {
  assert.equal(parseNumericInputValue("249000"), 249_000);
  assert.equal(parseNumericInputValue("0"), 0);
  assert.equal(parseNumericInputValue("Infinity"), "");
});

void test("narx va stock faqat manfiy bo‘lmagan butun sonni qabul qiladi", () => {
  assert.equal(nonNegativeIntegerInputSchema.safeParse(5).success, true);
  assert.equal(nonNegativeIntegerInputSchema.safeParse("").success, false);
  assert.equal(nonNegativeIntegerInputSchema.safeParse(-1).success, false);
  assert.equal(nonNegativeIntegerInputSchema.safeParse(1.5).success, false);
});
