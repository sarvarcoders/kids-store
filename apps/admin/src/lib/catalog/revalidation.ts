import "server-only";

import { requestCatalogRevalidation } from "@kids-store/core";

import { getAdminServerEnv } from "../env/server";

export async function revalidateCatalogAfterMutation(): Promise<void> {
  const env = getAdminServerEnv();

  if (
    env.CATALOG_REVALIDATION_URL === undefined ||
    env.CACHE_REVALIDATION_SECRET === undefined
  ) {
    console.warn(JSON.stringify({ event: "catalog_revalidation_not_configured" }));
    return;
  }

  try {
    await requestCatalogRevalidation({
      endpoint: env.CATALOG_REVALIDATION_URL,
      secret: env.CACHE_REVALIDATION_SECRET,
    });
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "catalog_revalidation_failed",
        errorName: error instanceof Error ? error.name : "UnknownError",
      }),
    );
  }
}
