"use client";

import {
  productListResponseSchema,
  type CatalogProductDto,
  type CategoryDto,
  type PaginationDto,
} from "@kids-store/shared/catalog";
import type { VerifiedTelegramUserDto } from "@kids-store/shared/telegram";
import dynamic from "next/dynamic";
import {
  useEffect,
  useState,
  type ReactNode,
  type SyntheticEvent,
} from "react";

import { fetchMiniAppApi } from "@/lib/api/client";
import { useCart } from "@/components/cart/cart-provider";
import { useTelegram } from "@/components/telegram/telegram-provider";
import { compactProductListItem } from "@/lib/catalog/product-dto";
import { fetchInitialCatalog } from "@/lib/catalog/catalog-client";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/ui/status-state";

const PRODUCTS_PER_PAGE = 12;
const ProductGrid = dynamic(
  () => import("./product-grid").then((module) => module.ProductGrid),
  {
    loading: () => <LoadingState label="Mahsulotlar ko‘rsatilmoqda" />,
  },
);

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Kutilmagan xato yuz berdi.";
}

export function CatalogPage(): ReactNode {
  const {
    initializationError,
    isReady,
    readInitData,
    retryInitialization,
  } = useTelegram();
  const { setCartQuantity } = useCart();
  const [viewer, setViewer] =
    useState<VerifiedTelegramUserDto | null>(null);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [discountProducts, setDiscountProducts] = useState<
    CatalogProductDto[]
  >([]);
  const [products, setProducts] = useState<CatalogProductDto[]>([]);
  const [defaultProducts, setDefaultProducts] = useState<
    CatalogProductDto[]
  >([]);
  const [pagination, setPagination] = useState<PaginationDto | null>(
    null,
  );
  const [defaultPagination, setDefaultPagination] =
    useState<PaginationDto | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [initialLoading, setInitialLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(true);
  const [initialError, setInitialError] = useState("");
  const [productsError, setProductsError] = useState("");
  const [searchError, setSearchError] = useState("");
  const [hasLoadedCatalog, setHasLoadedCatalog] = useState(false);
  const [catalogRetryVersion, setCatalogRetryVersion] = useState(0);
  const [productsRetryVersion, setProductsRetryVersion] = useState(0);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    const controller = new AbortController();

    async function loadInitialData(): Promise<void> {
      setInitialLoading(true);
      setProductsLoading(true);
      setInitialError("");
      setHasLoadedCatalog(false);

      try {
        const response = await fetchInitialCatalog(
          readInitData,
          controller.signal,
        );

        setViewer(response.user);
        setCategories(response.categories);
        setDiscountProducts(response.discountProducts);
        setProducts(response.products);
        setDefaultProducts(response.products);
        setPagination(response.pagination);
        setDefaultPagination(response.pagination);
        setCartQuantity(response.cartQuantity);
        setProductsError("");
        setHasLoadedCatalog(true);
      } catch (error) {
        if (!controller.signal.aborted) {
          setInitialError(getErrorMessage(error));
        }
      } finally {
        if (!controller.signal.aborted) {
          setInitialLoading(false);
          setProductsLoading(false);
        }
      }
    }

    void loadInitialData();

    return () => {
      controller.abort();
    };
  }, [
    catalogRetryVersion,
    isReady,
    readInitData,
    setCartQuantity,
  ]);

  useEffect(() => {
    if (!isReady || !hasLoadedCatalog) {
      return;
    }

    const isDefaultQuery =
      page === 1 && selectedCategory === "" && search === "";

    if (isDefaultQuery) {
      setProducts(defaultProducts);
      setPagination(defaultPagination);
      setProductsError("");
      setProductsLoading(false);
      return;
    }

    const controller = new AbortController();
    const query = new URLSearchParams({
      page: String(page),
      limit: String(PRODUCTS_PER_PAGE),
    });

    if (selectedCategory) {
      query.set("category", selectedCategory);
    }

    if (search) {
      query.set("search", search);
    }

    async function loadProducts(): Promise<void> {
      setProductsLoading(true);
      setProductsError("");

      try {
        const response = await fetchMiniAppApi(
          `/api/products?${query.toString()}`,
          readInitData,
          productListResponseSchema,
          controller.signal,
        );

        setProducts(response.data.map(compactProductListItem));
        setPagination(response.pagination);
      } catch (error) {
        if (!controller.signal.aborted) {
          setProductsError(getErrorMessage(error));
        }
      } finally {
        if (!controller.signal.aborted) {
          setProductsLoading(false);
        }
      }
    }

    void loadProducts();

    return () => {
      controller.abort();
    };
  }, [
    defaultPagination,
    defaultProducts,
    hasLoadedCatalog,
    isReady,
    page,
    readInitData,
    productsRetryVersion,
    search,
    selectedCategory,
  ]);

  function handleSearch(
    event: SyntheticEvent<HTMLFormElement>,
  ): void {
    event.preventDefault();
    const normalizedSearch = searchInput.trim();

    if (normalizedSearch.length === 1) {
      setSearchError("Qidiruv uchun kamida 2 ta belgi kiriting.");
      return;
    }

    setSearchError("");
    setPage(1);
    setSearch(normalizedSearch);
  }

  function selectCategory(slug: string): void {
    setSelectedCategory(slug);
    setPage(1);
  }

  if (initializationError) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-3xl px-3 py-5 sm:px-5">
        <ErrorState
          message={initializationError}
          onRetry={retryInitialization}
        />
      </main>
    );
  }

  const greeting = viewer
    ? `${viewer.firstName}, xush kelibsiz`
    : "Kichkintoylar uchun tanlangan";

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-3 pb-12 pt-[max(1rem,env(safe-area-inset-top))] sm:px-5">
      <header className="hero-card relative overflow-hidden rounded-[2rem] px-5 pb-6 pt-5 text-white shadow-[0_20px_50px_rgba(78,52,140,0.25)]">
        <div
          aria-hidden="true"
          className="absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/10"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-12 left-1/2 h-24 w-24 rounded-full bg-[var(--brand-yellow)]/30"
        />
        <div className="relative">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-white/75">
              Kids Store
            </p>
            <span
              aria-label="Faqat katalog rejimi"
              className="rounded-full bg-white/15 px-3 py-1 text-[0.68rem] font-bold"
            >
              Katalog MVP
            </span>
          </div>
          <p className="mt-8 text-sm font-semibold text-white/75">
            {greeting}
          </p>
          <h1 className="mt-1 max-w-sm text-[2rem] font-black leading-[1.05] tracking-[-0.04em]">
            Quvonch bilan kiyiladigan kiyimlar
          </h1>

          <form
            className="mt-6"
            onSubmit={handleSearch}
            role="search"
          >
            <label className="sr-only" htmlFor="catalog-search">
              Mahsulot qidirish
            </label>
            <div className="flex items-center gap-2 rounded-[1.2rem] bg-white p-1.5 shadow-lg">
              <span aria-hidden="true" className="pl-2 text-lg">
                🔎
              </span>
              <input
                className="focus-ring min-w-0 flex-1 rounded-xl px-1 py-2.5 text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400"
                id="catalog-search"
                maxLength={80}
                onChange={(event) => {
                  setSearchInput(event.target.value);
                  setSearchError("");
                }}
                placeholder="Nomi yoki kodi bo‘yicha"
                type="search"
                value={searchInput}
              />
              <button
                className="focus-ring rounded-[0.9rem] bg-[var(--brand-yellow)] px-3 py-2.5 text-xs font-black text-slate-900"
                type="submit"
              >
                Izlash
              </button>
            </div>
            {searchError ? (
              <p
                className="mt-2 text-xs font-semibold text-yellow-100"
                role="alert"
              >
                {searchError}
              </p>
            ) : null}
          </form>
        </div>
      </header>

      <section aria-labelledby="categories-title" className="mt-7">
        <div className="mb-3 flex items-end justify-between gap-3 px-1">
          <div>
            <p className="eyebrow">Bo‘limlar</p>
            <h2
              className="text-xl font-black tracking-[-0.025em]"
              id="categories-title"
            >
              Kategoriyalar
            </h2>
          </div>
        </div>

        <div
          aria-label="Mahsulot kategoriyalari"
          className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-2 sm:-mx-5 sm:px-5"
        >
          <button
            aria-pressed={selectedCategory === ""}
            className="category-pill focus-ring shrink-0"
            data-active={selectedCategory === ""}
            onClick={() => {
              selectCategory("");
            }}
            type="button"
          >
            Barchasi
          </button>
          {categories.map((category) => (
            <button
              aria-pressed={selectedCategory === category.slug}
              className="category-pill focus-ring shrink-0"
              data-active={selectedCategory === category.slug}
              key={category.id}
              onClick={() => {
                selectCategory(category.slug);
              }}
              type="button"
            >
              {category.name}
            </button>
          ))}
        </div>
      </section>

      <section aria-labelledby="discount-title" className="mt-7">
        <div className="mb-3 flex items-end justify-between gap-3 px-1">
          <div>
            <p className="eyebrow text-[var(--brand-coral)]">
              Tejamkor tanlov
            </p>
            <h2
              className="text-xl font-black tracking-[-0.025em]"
              id="discount-title"
            >
              Chegirmali mahsulotlar
            </h2>
          </div>
          <span aria-hidden="true" className="text-2xl">
            ✨
          </span>
        </div>

        {!isReady || initialLoading ? (
          <LoadingState label="Chegirmali mahsulotlar yuklanmoqda" />
        ) : initialError ? (
          <ErrorState
            message={initialError}
            onRetry={() => {
              setCatalogRetryVersion((value) => value + 1);
            }}
          />
        ) : discountProducts.length === 0 ? (
          <EmptyState
            description="Yangi chegirmalar qo‘shilganda shu yerda ko‘rinadi."
            title="Hozircha chegirma yo‘q"
          />
        ) : (
          <ProductGrid products={discountProducts} />
        )}
      </section>

      <section aria-labelledby="all-products-title" className="mt-9">
        <div className="mb-3 flex items-end justify-between gap-3 px-1">
          <div>
            <p className="eyebrow">Katalog</p>
            <h2
              className="text-xl font-black tracking-[-0.025em]"
              id="all-products-title"
            >
              Barcha mahsulotlar
            </h2>
          </div>
          {pagination ? (
            <p className="text-muted text-xs font-bold">
              {String(pagination.total)} ta
            </p>
          ) : null}
        </div>

        {!isReady || productsLoading ? (
          <LoadingState />
        ) : productsError ? (
          <ErrorState
            message={productsError}
            onRetry={() => {
              setProductsRetryVersion((value) => value + 1);
            }}
          />
        ) : products.length === 0 ? (
          <EmptyState
            description="Qidiruv yoki kategoriya filtrini o‘zgartirib ko‘ring."
            title="Mahsulot topilmadi"
          />
        ) : (
          <>
            <ProductGrid products={products} />
            {pagination &&
            (pagination.hasPreviousPage || pagination.hasNextPage) ? (
              <nav
                aria-label="Mahsulotlar sahifalari"
                className="mt-6 flex items-center justify-center gap-3"
              >
                <button
                  className="pagination-button focus-ring"
                  disabled={!pagination.hasPreviousPage}
                  onClick={() => {
                    setPage((value) => Math.max(1, value - 1));
                  }}
                  type="button"
                >
                  ← Oldingi
                </button>
                <span className="text-muted text-xs font-bold">
                  {String(pagination.page)} /{" "}
                  {String(pagination.totalPages)}
                </span>
                <button
                  className="pagination-button focus-ring"
                  disabled={!pagination.hasNextPage}
                  onClick={() => {
                    setPage((value) => value + 1);
                  }}
                  type="button"
                >
                  Keyingi →
                </button>
              </nav>
            ) : null}
          </>
        )}
      </section>
    </main>
  );
}
