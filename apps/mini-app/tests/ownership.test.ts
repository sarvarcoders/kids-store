import assert from "node:assert/strict";
import test from "node:test";

import {
  createOwnedCartItemWhere,
  createOwnedOrderWhere,
} from "../src/lib/auth/ownership.js";

void test("cart item mutation cart ownership bilan cheklanadi", () => {
  assert.deepEqual(createOwnedCartItemWhere(10, 20), {
    cartId: 10,
    id: 20,
  });
});

void test("order detail customer ownership bilan cheklanadi", () => {
  assert.deepEqual(createOwnedOrderWhere(30, 40), {
    customerId: 30,
    id: 40,
  });
});
