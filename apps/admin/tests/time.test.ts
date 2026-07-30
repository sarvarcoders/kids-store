import assert from "node:assert/strict";
import test from "node:test";

import { getTashkentDayRange } from "../src/lib/time/tashkent.js";

void test("Asia/Tashkent kun chegarasini UTC+5 bilan hisoblaydi", () => {
  const range = getTashkentDayRange(
    new Date("2026-07-31T10:00:00.000Z"),
  );

  assert.equal(range.start.toISOString(), "2026-07-30T19:00:00.000Z");
  assert.equal(range.end.toISOString(), "2026-07-31T19:00:00.000Z");
});
