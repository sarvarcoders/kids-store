import { gzipSync } from "node:zlib";

export const CATALOG_GZIP_BUDGET_BYTES = 100 * 1_024;

export interface PayloadSizeMeasurement {
  gzipBytes: number;
  jsonBytes: number;
  withinBudget: boolean;
}

export function measureCatalogPayload(
  payload: unknown,
): PayloadSizeMeasurement {
  const json = JSON.stringify(payload);
  const jsonBytes = Buffer.byteLength(json);
  const gzipBytes = gzipSync(json).byteLength;

  return {
    gzipBytes,
    jsonBytes,
    withinBudget: gzipBytes <= CATALOG_GZIP_BUDGET_BYTES,
  };
}
