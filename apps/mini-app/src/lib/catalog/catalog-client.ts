import {
  catalogResponseSchema,
  type CatalogResponse,
} from "@kids-store/shared/catalog";

import { fetchMiniAppApi } from "../api/client";

export async function fetchInitialCatalog(
  readInitData: () => string,
  signal?: AbortSignal,
): Promise<CatalogResponse> {
  return fetchMiniAppApi(
    "/api/catalog",
    readInitData,
    catalogResponseSchema,
    signal,
  );
}
