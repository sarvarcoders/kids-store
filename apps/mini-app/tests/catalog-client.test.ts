import assert from "node:assert/strict";
import test from "node:test";

import { fetchInitialCatalog } from "../src/lib/catalog/catalog-client.js";

void test("initial katalog barcha ma’lumotni bitta API requestda oladi", async () => {
  const originalFetch = globalThis.fetch;
  let requestCount = 0;
  let requestedUrl = "";
  const fetchMock: typeof fetch = (input) => {
    requestCount += 1;
    requestedUrl =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    return Promise.resolve(
      new Response(
        JSON.stringify({
          categories: [],
          products: [],
          discountProducts: [],
          user: {
            id: "123456",
            firstName: "Test",
          },
          pagination: {
            page: 1,
            limit: 12,
            total: 0,
            totalPages: 0,
            hasPreviousPage: false,
            hasNextPage: false,
          },
          cartQuantity: 0,
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );
  };

  globalThis.fetch = fetchMock;

  try {
    const result = await fetchInitialCatalog(() => "signed-init-data");

    assert.equal(requestCount, 1);
    assert.equal(requestedUrl, "/api/catalog");
    assert.equal(result.user.id, "123456");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
