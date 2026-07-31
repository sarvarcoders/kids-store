import { requestCatalogRevalidation } from "@kids-store/core";

import { env } from "../config/env.js";
import { logger } from "../config/logger.js";

export async function revalidateCatalogAfterStockChange(): Promise<void> {
  if (
    env.CATALOG_REVALIDATION_URL === undefined ||
    env.CACHE_REVALIDATION_SECRET === undefined
  ) {
    logger.warn("Catalog cache invalidation sozlanmagan");
    return;
  }

  try {
    await requestCatalogRevalidation({
      endpoint: env.CATALOG_REVALIDATION_URL,
      secret: env.CACHE_REVALIDATION_SECRET,
    });
  } catch (error) {
    logger.error("Catalog cache invalidation bajarilmadi", error);
  }
}
