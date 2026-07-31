import "server-only";

import {
  productQuerySchema,
  type CatalogProductDto,
  type CategoryDto,
  type PaginationDto,
} from "@kids-store/shared";
import { unstable_cache } from "next/cache";

import {
  listCatalogCategories,
  listCatalogProductCards,
  listDiscountCatalogProductCards,
} from "./catalog.service";

const CATALOG_CACHE_SECONDS = 60;
const DEFAULT_PRODUCT_LIMIT = 12;
const DISCOUNT_PRODUCT_LIMIT = 6;

export interface CachedCatalogData {
  categories: CategoryDto[];
  products: CatalogProductDto[];
  discountProducts: CatalogProductDto[];
  pagination: PaginationDto;
}

async function loadCatalogData(): Promise<CachedCatalogData> {
  const defaultQuery = productQuerySchema.parse({
    page: 1,
    limit: DEFAULT_PRODUCT_LIMIT,
  });
  const [categories, productPage, discountProducts] =
    await Promise.all([
      listCatalogCategories(),
      listCatalogProductCards(defaultQuery),
      listDiscountCatalogProductCards(DISCOUNT_PRODUCT_LIMIT),
    ]);

  return {
    categories,
    products: productPage.data,
    discountProducts,
    pagination: productPage.pagination,
  };
}

export const getCachedCatalogData = unstable_cache(
  loadCatalogData,
  ["mini-app-catalog-v1"],
  {
    revalidate: CATALOG_CACHE_SECONDS,
    tags: ["catalog"],
  },
);
