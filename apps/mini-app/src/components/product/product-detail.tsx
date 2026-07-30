"use client";

import {
  productDetailResponseSchema,
  type ProductDetailDto,
} from "@kids-store/shared";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { useTelegram } from "@/components/telegram/telegram-provider";
import {
  ErrorState,
  LoadingState,
} from "@/components/ui/status-state";
import { fetchMiniAppApi } from "@/lib/api/client";
import { formatUzbekPrice } from "@/lib/format/price";
import { showTelegramBackButton } from "@/lib/telegram/web-app";

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Kutilmagan xato yuz berdi.";
}

export function ProductDetail({
  productId,
}: {
  productId: string;
}): ReactNode {
  const router = useRouter();
  const {
    initData,
    initializationError,
    isReady,
    retryInitialization,
  } = useTelegram();
  const [product, setProduct] = useState<ProductDetailDto | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryVersion, setRetryVersion] = useState(0);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    return showTelegramBackButton(() => {
      router.back();
    });
  }, [isReady, router]);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    const controller = new AbortController();

    async function loadProduct(): Promise<void> {
      setIsLoading(true);
      setError("");

      try {
        const response = await fetchMiniAppApi(
          `/api/products/${encodeURIComponent(productId)}`,
          initData,
          productDetailResponseSchema,
          controller.signal,
        );

        setProduct(response.data);
        setActiveImageIndex(0);
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setError(getErrorMessage(loadError));
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void loadProduct();

    return () => {
      controller.abort();
    };
  }, [initData, isReady, productId, retryVersion]);

  const uniqueSizes = useMemo(
    () =>
      product
        ? Array.from(
            new Set(product.variants.map((variant) => variant.size)),
          )
        : [],
    [product],
  );
  const uniqueColors = useMemo(
    () =>
      product
        ? Array.from(
            new Set(product.variants.map((variant) => variant.color)),
          )
        : [],
    [product],
  );

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

  if (!isReady || isLoading) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-3xl px-3 py-5 sm:px-5">
        <LoadingState label="Mahsulot ma’lumoti yuklanmoqda" />
      </main>
    );
  }

  if (error || !product) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-3xl px-3 py-5 sm:px-5">
        <Link
          className="focus-ring mb-5 inline-flex rounded-full px-2 py-1 text-sm font-bold text-[var(--brand-purple)]"
          href="/"
        >
          ← Katalogga qaytish
        </Link>
        <ErrorState
          message={error || "Mahsulot topilmadi."}
          onRetry={() => {
            setRetryVersion((value) => value + 1);
          }}
        />
      </main>
    );
  }

  const activeImage = product.images[activeImageIndex];
  const hasDiscount =
    product.discountPrice !== null &&
    product.discountPrice < product.price;
  const currentPrice = hasDiscount
    ? product.discountPrice
    : product.price;

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-3 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] sm:px-5">
      <nav aria-label="Ortga qaytish" className="mb-4">
        <Link
          className="surface focus-ring inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-extrabold"
          href="/"
        >
          <span aria-hidden="true">←</span>
          Katalog
        </Link>
      </nav>

      <article>
        <section aria-label="Mahsulot rasmlari">
          <div className="image-panel relative aspect-square overflow-hidden rounded-[2rem]">
            {activeImage ? (
              <Image
                alt={`${product.name} — ${String(activeImageIndex + 1)}-rasm`}
                className="object-cover"
                fill
                priority
                sizes="(max-width: 768px) 100vw, 700px"
                src={activeImage.url}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-7xl">
                👕
              </div>
            )}
            {hasDiscount ? (
              <span className="absolute left-4 top-4 rounded-full bg-[var(--brand-coral)] px-3 py-1.5 text-xs font-black uppercase tracking-wide text-white">
                Chegirmada
              </span>
            ) : null}
          </div>

          {product.images.length > 1 ? (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {product.images.map((image, index) => (
                <button
                  aria-label={`${String(index + 1)}-rasmni ko‘rsatish`}
                  aria-pressed={activeImageIndex === index}
                  className="focus-ring relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border-2 border-transparent data-[active=true]:border-[var(--brand-purple)]"
                  data-active={activeImageIndex === index}
                  key={image.id}
                  onClick={() => {
                    setActiveImageIndex(index);
                  }}
                  type="button"
                >
                  <Image
                    alt=""
                    className="object-cover"
                    fill
                    sizes="64px"
                    src={image.url}
                  />
                </button>
              ))}
            </div>
          ) : null}
        </section>

        <section className="surface mt-4 rounded-[2rem] px-5 py-6 sm:px-7">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[var(--brand-yellow)]/35 px-3 py-1 text-xs font-black text-slate-800">
              {product.category.name}
            </span>
            <span className="text-muted text-xs font-bold">
              Kod: {product.code}
            </span>
          </div>

          <h1 className="mt-4 text-[1.8rem] font-black leading-tight tracking-[-0.04em]">
            {product.name}
          </h1>

          <div className="mt-4">
            {hasDiscount ? (
              <p className="text-muted text-sm font-semibold line-through">
                {formatUzbekPrice(product.price)}
              </p>
            ) : null}
            <p className="text-2xl font-black text-[var(--brand-purple)]">
              {formatUzbekPrice(currentPrice)}
            </p>
          </div>

          <div className="mt-6">
            <h2 className="text-sm font-black uppercase tracking-[0.12em]">
              Tavsif
            </h2>
            <p className="text-muted mt-2 text-sm leading-6">
              {product.description ?? "Mahsulot tavsifi mavjud emas."}
            </p>
          </div>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <div>
              <h2 className="text-sm font-black uppercase tracking-[0.12em]">
                O‘lchamlar
              </h2>
              <div className="mt-2 flex flex-wrap gap-2">
                {uniqueSizes.map((size) => (
                  <span className="detail-chip" key={size}>
                    {size}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <h2 className="text-sm font-black uppercase tracking-[0.12em]">
                Ranglar
              </h2>
              <div className="mt-2 flex flex-wrap gap-2">
                {uniqueColors.map((color) => (
                  <span className="detail-chip" key={color}>
                    {color}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-7">
            <h2 className="text-sm font-black uppercase tracking-[0.12em]">
              Mavjud variantlar
            </h2>
            <ul className="mt-3 grid gap-2" role="list">
              {product.variants.map((variant) => (
                <li
                  className="flex items-center justify-between gap-3 rounded-2xl bg-[var(--soft-panel)] px-4 py-3 text-sm"
                  key={variant.id}
                >
                  <span className="font-extrabold">
                    {variant.size} · {variant.color}
                  </span>
                  <span className="text-muted font-bold">
                    {String(variant.stock)} dona
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <button
            aria-describedby="cart-coming-soon"
            className="mt-7 w-full cursor-not-allowed rounded-[1.15rem] bg-slate-300 px-5 py-4 text-sm font-black text-slate-600 dark:bg-slate-700 dark:text-slate-300"
            disabled
            type="button"
          >
            🛍 Savatcha — keyingi bosqichda
          </button>
          <p
            className="text-muted mt-2 text-center text-xs"
            id="cart-coming-soon"
          >
            Hozircha katalog faqat ko‘rish rejimida.
          </p>
        </section>
      </article>
    </main>
  );
}
