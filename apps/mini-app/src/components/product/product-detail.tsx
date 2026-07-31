"use client";

import { cartResponseSchema } from "@kids-store/shared/cart";
import {
  productDetailResponseSchema,
  type ProductDetailDto,
} from "@kids-store/shared/catalog";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { useCart } from "@/components/cart/cart-provider";
import { useTelegram } from "@/components/telegram/telegram-provider";
import {
  ErrorState,
  LoadingState,
} from "@/components/ui/status-state";
import {
  fetchMiniAppApi,
  requestMiniAppApi,
} from "@/lib/api/client";
import { formatUzbekPrice } from "@/lib/format/price";
import { PRODUCT_IMAGE_BLUR_DATA_URL } from "@/lib/images/placeholder";
import {
  findSelectedProductVariant,
  getAvailableColorsForSize,
  getMaximumSelectableQuantity,
} from "@/lib/catalog/product-selection";
import {
  notifyTelegramHaptic,
  showTelegramBackButton,
} from "@/lib/telegram/web-app";

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
  const { cart, replaceCart } = useCart();
  const {
    initializationError,
    isReady,
    readInitData,
    retryInitialization,
  } = useTelegram();
  const [product, setProduct] = useState<ProductDetailDto | null>(
    null,
  );
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [selectedSize, setSelectedSize] = useState("");
  const [selectedColor, setSelectedColor] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState("");
  const [cartMessage, setCartMessage] = useState("");
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
          readInitData,
          productDetailResponseSchema,
          controller.signal,
        );

        setProduct(response.data);
        setActiveImageIndex(0);
        setSelectedSize("");
        setSelectedColor("");
        setQuantity(1);
        setCartMessage("");
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
  }, [isReady, productId, readInitData, retryVersion]);

  const availableSizes = useMemo(
    () =>
      product
        ? Array.from(
            new Set(product.variants.map((variant) => variant.size)),
          )
        : [],
    [product],
  );
  const availableColors = useMemo(
    () =>
      product && selectedSize
        ? getAvailableColorsForSize(product.variants, selectedSize)
        : [],
    [product, selectedSize],
  );
  const selectedVariant = useMemo(
    () =>
      product && selectedSize && selectedColor
        ? findSelectedProductVariant(product.variants, {
            size: selectedSize,
            color: selectedColor,
          })
        : null,
    [product, selectedColor, selectedSize],
  );
  const maximumQuantity = selectedVariant
    ? getMaximumSelectableQuantity(selectedVariant.stock)
    : 1;

  async function handleAddToCart(): Promise<void> {
    if (!selectedVariant || isAdding) {
      return;
    }

    const wasAlreadyInCart =
      cart?.items.some(
        (item) => item.variantId === selectedVariant.id,
      ) ?? false;
    setIsAdding(true);
    setCartMessage("");

    try {
      const response = await requestMiniAppApi(
        "/api/cart/items",
        readInitData,
        cartResponseSchema,
        {
          method: "POST",
          body: {
            productVariantId: selectedVariant.id,
            quantity,
          },
        },
      );
      replaceCart(response.data);
      setCartMessage(
        wasAlreadyInCart
          ? "Savatchadagi variant miqdori yangilandi."
          : "Mahsulot savatchaga qo‘shildi.",
      );
      notifyTelegramHaptic("success");
    } catch (addError) {
      setCartMessage(getErrorMessage(addError));
      notifyTelegramHaptic("error");
    } finally {
      setIsAdding(false);
    }
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
          className="focus-ring mb-5 inline-flex rounded-full px-2 py-1 text-sm font-bold"
          href="/catalog"
          prefetch={false}
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
    <main className="mx-auto min-h-screen w-full max-w-3xl px-3 pt-[max(1rem,env(safe-area-inset-top))] sm:px-5">
      <Link
        className="surface focus-ring mb-4 inline-flex rounded-full px-4 py-2 text-sm font-extrabold"
        href="/catalog"
        prefetch={false}
      >
        ← Katalog
      </Link>

      <article>
        <section aria-label="Mahsulot rasmlari">
          <div className="image-panel relative aspect-square overflow-hidden rounded-[2rem]">
            {activeImage ? (
              <Image
                alt={`${product.name} — ${String(activeImageIndex + 1)}-rasm`}
                blurDataURL={PRODUCT_IMAGE_BLUR_DATA_URL}
                className="object-cover"
                fill
                placeholder="blur"
                priority
                sizes="(max-width: 768px) 100vw, 700px"
                src={activeImage.url}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-7xl">
                👕
              </div>
            )}
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
                    blurDataURL={PRODUCT_IMAGE_BLUR_DATA_URL}
                    className="object-cover"
                    fill
                    loading="lazy"
                    placeholder="blur"
                    sizes="64px"
                    src={image.url}
                  />
                </button>
              ))}
            </div>
          ) : null}
        </section>

        <section className="surface mt-4 rounded-[2rem] px-5 py-6 sm:px-7">
          <p className="text-muted text-xs font-bold">
            {product.category.name} · Kod: {product.code}
          </p>
          <h1 className="mt-3 text-[1.8rem] font-black leading-tight">
            {product.name}
          </h1>
          <div className="mt-4">
            {hasDiscount ? (
              <p className="text-muted text-sm line-through">
                {formatUzbekPrice(product.price)}
              </p>
            ) : null}
            <p className="text-2xl font-black text-[var(--brand-purple)]">
              {formatUzbekPrice(currentPrice)}
            </p>
          </div>
          <p className="text-muted mt-5 text-sm leading-6">
            {product.description ?? "Mahsulot tavsifi mavjud emas."}
          </p>

          <fieldset className="mt-6">
            <legend className="text-sm font-black uppercase tracking-[0.12em]">
              O‘lcham
            </legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {availableSizes.map((size) => (
                <button
                  aria-pressed={selectedSize === size}
                  className="detail-chip focus-ring"
                  data-active={selectedSize === size}
                  key={size}
                  onClick={() => {
                    setSelectedSize(size);
                    setSelectedColor("");
                    setQuantity(1);
                    setCartMessage("");
                  }}
                  type="button"
                >
                  {size}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="mt-5">
            <legend className="text-sm font-black uppercase tracking-[0.12em]">
              Rang
            </legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {availableColors.length === 0 ? (
                <span className="text-muted text-xs">
                  Avval o‘lchamni tanlang.
                </span>
              ) : null}
              {availableColors.map((color) => (
                <button
                  aria-pressed={selectedColor === color}
                  className="detail-chip focus-ring"
                  data-active={selectedColor === color}
                  key={color}
                  onClick={() => {
                    setSelectedColor(color);
                    setQuantity(1);
                    setCartMessage("");
                  }}
                  type="button"
                >
                  {color}
                </button>
              ))}
            </div>
          </fieldset>

          {selectedVariant ? (
            <div className="mt-6 flex items-center justify-between gap-3 rounded-2xl bg-[var(--soft-panel)] p-4">
              <span className="text-sm font-extrabold">
                Mavjud: {String(selectedVariant.stock)} dona
              </span>
              <label
                className="flex items-center gap-2 text-sm font-bold"
                htmlFor="product-quantity"
              >
                Miqdor
                <select
                  className="focus-ring rounded-xl bg-white px-3 py-2 text-slate-900"
                  id="product-quantity"
                  onChange={(event) => {
                    setQuantity(Number(event.target.value));
                  }}
                  value={quantity}
                >
                  {Array.from(
                    { length: maximumQuantity },
                    (_, index) => index + 1,
                  ).map((value) => (
                    <option key={value} value={value}>
                      {String(value)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}

          <button
            className="focus-ring mt-7 w-full rounded-[1.15rem] bg-[var(--brand-purple)] px-5 py-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!selectedVariant || isAdding}
            onClick={() => {
              void handleAddToCart();
            }}
            type="button"
          >
            {isAdding ? "Qo‘shilmoqda…" : "🛍 Savatchaga qo‘shish"}
          </button>
          {!selectedVariant ? (
            <p className="text-muted mt-2 text-center text-xs">
              O‘lcham va rangni tanlang.
            </p>
          ) : null}
          {cartMessage ? (
            <p
              className="mt-3 text-center text-sm font-bold"
              role="status"
            >
              {cartMessage}
            </p>
          ) : null}
        </section>
      </article>
    </main>
  );
}
