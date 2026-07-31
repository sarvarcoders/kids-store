import type { CatalogResponse } from "@kids-store/shared/catalog";

import { requestMiniAppApiJson } from "../api/client";

export async function fetchInitialCatalog(
  readInitData: () => string,
  signal?: AbortSignal,
): Promise<CatalogResponse> {
  return requestMiniAppApiJson<CatalogResponse>(
    "/api/catalog",
    readInitData,
    signal === undefined ? {} : { signal },
  );
}
