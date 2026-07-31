import { timingSafeEqual } from "node:crypto";

import { z } from "zod";

const endpointSchema = z.url().refine(
  (value) => new URL(value).protocol === "https:" || new URL(value).hostname === "localhost",
  "Cache revalidation endpoint HTTPS bo‘lishi kerak",
);
const secretSchema = z.string().min(32).max(256);

export interface CatalogRevalidationConfig {
  endpoint: string;
  secret: string;
}

export function hasMatchingRevalidationSecret(
  suppliedInput: string | null,
  expectedInput: string,
): boolean {
  if (suppliedInput === null) {
    return false;
  }

  const supplied = Buffer.from(suppliedInput);
  const expected = Buffer.from(secretSchema.parse(expectedInput));

  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export async function requestCatalogRevalidation(
  input: CatalogRevalidationConfig,
): Promise<void> {
  const endpoint = endpointSchema.parse(input.endpoint);
  const secret = secretSchema.parse(input.secret);
  const response = await fetch(endpoint, {
    method: "POST",
    cache: "no-store",
    headers: {
      "cache-control": "no-store",
      "x-cache-revalidation-secret": secret,
    },
  });

  if (!response.ok) {
    throw new Error(`Catalog cache invalidation failed (${String(response.status)})`);
  }
}
