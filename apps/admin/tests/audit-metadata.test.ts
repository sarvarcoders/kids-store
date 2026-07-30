import assert from "node:assert/strict";
import test from "node:test";

import { formatSafeAuditMetadata } from "../src/lib/audit/metadata.js";

void test("audit metadata secret kalitlarni mask qiladi", () => {
  const result = formatSafeAuditMetadata({
    action: "updated",
    token: "secret-value",
    nested: {
      rawInitData: "sensitive",
      value: 3,
    },
  });

  assert.doesNotMatch(result, /secret-value|sensitive/);
  assert.match(result, /\[MASKED\]/);
  assert.match(result, /updated/);
});
