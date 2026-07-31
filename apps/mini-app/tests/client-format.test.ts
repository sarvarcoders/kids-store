import assert from "node:assert/strict";
import test from "node:test";

import { formatMiniAppOrderStatus } from "../src/lib/format/order-status.js";
import { formatUzbekPrice } from "../src/lib/format/price.js";

void test("client narxni yengil validator bilan so‘mda formatlaydi", () => {
  assert.equal(formatUzbekPrice(199_000), "199 000 so‘m");
  assert.throws(() => formatUzbekPrice(-1));
  assert.throws(() => formatUzbekPrice(1.5));
});

void test("client order statusini xavfsiz labelga aylantiradi", () => {
  assert.equal(formatMiniAppOrderStatus("PENDING"), "Kutilmoqda");
  assert.equal(formatMiniAppOrderStatus(" UNKNOWN "), "Noma’lum holat");
});
