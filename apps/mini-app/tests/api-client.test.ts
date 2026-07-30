import assert from "node:assert/strict";
import test from "node:test";

import { z } from "zod";

import {
  fetchMiniAppApi,
  TELEGRAM_INIT_DATA_HEADER,
} from "../src/lib/api/client.js";

const responseSchema = z.object({
  data: z.literal("ok"),
});

void test("kech kelgan initData bilan fetch eng yangi raw qiymatni yuboradi", async () => {
  const originalFetch = globalThis.fetch;
  let currentInitData = "";
  let receivedInitData: string | null = null;
  const readInitData = (): string => currentInitData;
  const fetchMock: typeof fetch = (_input, init) => {
    receivedInitData = new Headers(init?.headers).get(
      TELEGRAM_INIT_DATA_HEADER,
    );

    return Promise.resolve(
      new Response(JSON.stringify({ data: "ok" }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }),
    );
  };

  globalThis.fetch = fetchMock;

  try {
    currentInitData =
      "auth_date=1&user=%7B%22id%22%3A1%7D&hash=latest";
    const response = await fetchMiniAppApi(
      "/api/auth/me",
      readInitData,
      responseSchema,
    );

    assert.equal(response.data, "ok");
    assert.equal(receivedInitData, currentInitData);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
