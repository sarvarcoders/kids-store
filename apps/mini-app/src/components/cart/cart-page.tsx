"use client";

import {
  cartResponseSchema,
  checkoutInputSchema,
  checkoutResponseSchema,
  type CartItemDto,
  type CheckoutOrderDto,
} from "@kids-store/shared";
import Image from "next/image";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { useCart } from "@/components/cart/cart-provider";
import { useTelegram } from "@/components/telegram/telegram-provider";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/ui/status-state";
import { requestMiniAppApi } from "@/lib/api/client";
import {
  clearCartOptimistically,
  removeCartItemOptimistically,
  updateCartQuantityOptimistically,
} from "@/lib/cart/cart-ui-state";
import { formatUzbekPrice } from "@/lib/format/price";
import {
  hasTelegramMainButton,
  notifyTelegramHaptic,
  showTelegramMainButton,
} from "@/lib/telegram/web-app";

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Kutilmagan xato yuz berdi.";
}

function CartItemCard({
  item,
  isPending,
  onQuantityChange,
  onRemove,
}: {
  item: CartItemDto;
  isPending: boolean;
  onQuantityChange: (quantity: number) => void;
  onRemove: () => void;
}): ReactNode {
  const maximumQuantity = Math.min(5, item.stock);

  return (
    <li
      className={`surface rounded-3xl p-4 ${
        item.isAvailable ? "" : "opacity-70"
      }`}
    >
      <div className="flex gap-3">
        <div className="image-panel relative h-24 w-20 shrink-0 overflow-hidden rounded-2xl">
          {item.productImage ? (
            <Image
              alt={item.productName}
              className="object-cover"
              fill
              sizes="80px"
              src={item.productImage}
            />
          ) : (
            <span className="flex h-full items-center justify-center text-3xl">
              👕
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <Link
            className="focus-ring font-black"
            href={`/products/${String(item.productId)}`}
          >
            {item.productName}
          </Link>
          <p className="text-muted mt-1 text-xs">
            {item.productCode} · {item.size} / {item.color}
          </p>
          <p className="mt-2 text-sm font-black text-[var(--brand-purple)]">
            {formatUzbekPrice(item.unitPrice)}
          </p>
          {!item.isAvailable ? (
            <p className="mt-2 text-xs font-bold text-[var(--brand-coral)]">
              Hozir mavjud emas yoki qoldiq yetarli emas.
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            aria-label={`${item.productName} miqdorini kamaytirish`}
            className="focus-ring h-10 w-10 rounded-xl bg-[var(--soft-panel)] font-black"
            disabled={isPending || item.quantity <= 1}
            onClick={() => {
              onQuantityChange(item.quantity - 1);
            }}
            type="button"
          >
            −
          </button>
          <span
            aria-label={`${String(item.quantity)} dona`}
            className="min-w-8 text-center font-black"
          >
            {String(item.quantity)}
          </span>
          <button
            aria-label={`${item.productName} miqdorini oshirish`}
            className="focus-ring h-10 w-10 rounded-xl bg-[var(--soft-panel)] font-black"
            disabled={
              isPending ||
              !item.isAvailable ||
              item.quantity >= maximumQuantity
            }
            onClick={() => {
              onQuantityChange(item.quantity + 1);
            }}
            type="button"
          >
            +
          </button>
        </div>
        <div className="text-right">
          <p className="font-black">
            {formatUzbekPrice(item.subtotal)}
          </p>
          <button
            className="focus-ring mt-1 text-xs font-bold text-[var(--brand-coral)]"
            disabled={isPending}
            onClick={onRemove}
            type="button"
          >
            O‘chirish
          </button>
        </div>
      </div>
    </li>
  );
}

export function CartPage(): ReactNode {
  const {
    cart,
    error,
    isLoading,
    refreshCart,
    replaceCart,
  } = useCart();
  const {
    initializationError,
    isReady,
    readInitData,
    retryInitialization,
  } = useTelegram();
  const [pendingItemId, setPendingItemId] = useState<number | null>(
    null,
  );
  const [isClearing, setIsClearing] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [phone, setPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [message, setMessage] = useState("");
  const [createdOrder, setCreatedOrder] =
    useState<CheckoutOrderDto | null>(null);
  const [telegramMainButtonAvailable, setTelegramMainButtonAvailable] =
    useState(false);

  useEffect(() => {
    if (cart?.customerPhone && phone.length === 0) {
      setPhone(cart.customerPhone);
    }
  }, [cart?.customerPhone, phone.length]);

  useEffect(() => {
    setTelegramMainButtonAvailable(hasTelegramMainButton());
  }, []);

  const checkoutValidation = useMemo(
    () =>
      checkoutInputSchema.safeParse({
        phone,
        deliveryAddress,
        idempotencyKey,
      }),
    [deliveryAddress, idempotencyKey, phone],
  );

  async function updateQuantity(
    item: CartItemDto,
    quantity: number,
  ): Promise<void> {
    if (!cart || pendingItemId !== null) {
      return;
    }

    const previousCart = cart;
    setPendingItemId(item.id);
    setMessage("");
    replaceCart(
      updateCartQuantityOptimistically(cart, item.id, quantity),
    );

    try {
      const response = await requestMiniAppApi(
        `/api/cart/items/${String(item.id)}`,
        readInitData,
        cartResponseSchema,
        {
          method: "PATCH",
          body: { quantity },
        },
      );
      replaceCart(response.data);
    } catch (updateError) {
      replaceCart(previousCart);
      setMessage(getErrorMessage(updateError));
      notifyTelegramHaptic("error");
    } finally {
      setPendingItemId(null);
    }
  }

  async function removeItem(item: CartItemDto): Promise<void> {
    if (!cart || pendingItemId !== null) {
      return;
    }

    const previousCart = cart;
    setPendingItemId(item.id);
    setMessage("");
    replaceCart(removeCartItemOptimistically(cart, item.id));

    try {
      const response = await requestMiniAppApi(
        `/api/cart/items/${String(item.id)}`,
        readInitData,
        cartResponseSchema,
        { method: "DELETE" },
      );
      replaceCart(response.data);
    } catch (removeError) {
      replaceCart(previousCart);
      setMessage(getErrorMessage(removeError));
      notifyTelegramHaptic("error");
    } finally {
      setPendingItemId(null);
    }
  }

  async function clearCurrentCart(): Promise<void> {
    if (!cart || isClearing) {
      return;
    }

    const previousCart = cart;
    setIsClearing(true);
    setMessage("");
    replaceCart(clearCartOptimistically(cart));

    try {
      const response = await requestMiniAppApi(
        "/api/cart",
        readInitData,
        cartResponseSchema,
        { method: "DELETE" },
      );
      replaceCart(response.data);
      setIsCheckoutOpen(false);
    } catch (clearError) {
      replaceCart(previousCart);
      setMessage(getErrorMessage(clearError));
      notifyTelegramHaptic("error");
    } finally {
      setIsClearing(false);
    }
  }

  const submitCheckout = useCallback(async (): Promise<void> => {
    if (!checkoutValidation.success || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setMessage("");

    try {
      const response = await requestMiniAppApi(
        "/api/checkout",
        readInitData,
        checkoutResponseSchema,
        {
          method: "POST",
          body: checkoutValidation.data,
        },
      );
      setCreatedOrder(response.data.order);
      setIsCheckoutOpen(false);
      notifyTelegramHaptic("success");
      await refreshCart();
    } catch (checkoutError) {
      setMessage(getErrorMessage(checkoutError));
      notifyTelegramHaptic("error");
    } finally {
      setIsSubmitting(false);
    }
  }, [
    checkoutValidation,
    isSubmitting,
    readInitData,
    refreshCart,
  ]);

  useEffect(
    () =>
      showTelegramMainButton({
        text: "Buyurtmani tasdiqlash",
        enabled: checkoutValidation.success && !isSubmitting,
        loading: isSubmitting,
        onClick: () => {
          void submitCheckout();
        },
        visible:
          isCheckoutOpen &&
          (cart?.items.length ?? 0) > 0 &&
          createdOrder === null,
      }),
    [
      cart?.items.length,
      checkoutValidation.success,
      createdOrder,
      isCheckoutOpen,
      isSubmitting,
      submitCheckout,
    ],
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

  if (!isReady || isLoading || !cart) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-3xl px-3 py-5 sm:px-5">
        <LoadingState label="Savatcha yuklanmoqda" />
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-3xl px-3 py-5 sm:px-5">
        <ErrorState
          message={error}
          onRetry={() => {
            void refreshCart();
          }}
        />
      </main>
    );
  }

  if (createdOrder) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-3xl px-3 py-5 sm:px-5">
        <section className="surface rounded-[2rem] p-6 text-center">
          <p className="text-5xl" aria-hidden="true">
            ✅
          </p>
          <h1 className="mt-4 text-2xl font-black">
            Buyurtma qabul qilindi
          </h1>
          <p className="text-muted mt-2">
            Buyurtma ID: {String(createdOrder.id)}
          </p>
          <p className="mt-3 text-xl font-black text-[var(--brand-purple)]">
            {formatUzbekPrice(createdOrder.totalAmount)}
          </p>
          <Link
            className="focus-ring mt-5 inline-flex rounded-xl bg-[var(--brand-purple)] px-5 py-3 font-black text-white"
            href={`/orders/${String(createdOrder.id)}`}
          >
            Buyurtmani ko‘rish
          </Link>
        </section>
      </main>
    );
  }

  const sortedItems = [...cart.items].sort(
    (first, second) =>
      Number(second.isAvailable) - Number(first.isAvailable),
  );

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-3 py-5 sm:px-5">
      <header className="flex items-center justify-between gap-3">
        <div>
          <p className="eyebrow">Xaridlar</p>
          <h1 className="text-2xl font-black">Savatcha</h1>
        </div>
        {cart.items.length > 0 ? (
          <button
            className="focus-ring text-xs font-bold text-[var(--brand-coral)]"
            disabled={isClearing}
            onClick={() => {
              void clearCurrentCart();
            }}
            type="button"
          >
            {isClearing ? "Tozalanmoqda…" : "Barchasini tozalash"}
          </button>
        ) : null}
      </header>

      {message ? (
        <p
          className="mt-4 rounded-2xl bg-[var(--soft-panel)] p-3 text-sm font-bold"
          role="alert"
        >
          {message}
        </p>
      ) : null}

      {cart.items.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            description="Katalogdan o‘zingizga yoqqan mahsulotlarni tanlang."
            title="Savatcha bo‘sh"
          />
          <Link
            className="focus-ring mx-auto mt-5 flex w-fit rounded-xl bg-[var(--brand-purple)] px-5 py-3 font-black text-white"
            href="/catalog"
          >
            Katalogga o‘tish
          </Link>
        </div>
      ) : (
        <>
          <ul className="mt-5 grid gap-3" role="list">
            {sortedItems.map((item) => (
              <CartItemCard
                isPending={pendingItemId === item.id}
                item={item}
                key={item.id}
                onQuantityChange={(nextQuantity) => {
                  void updateQuantity(item, nextQuantity);
                }}
                onRemove={() => {
                  void removeItem(item);
                }}
              />
            ))}
          </ul>

          <section className="surface mt-5 rounded-[2rem] p-5">
            <div className="flex justify-between gap-3 text-sm">
              <span className="text-muted">Jami mahsulot</span>
              <strong>{String(cart.totalQuantity)} dona</strong>
            </div>
            <div className="mt-2 flex justify-between gap-3 text-lg">
              <span className="font-black">Jami summa</span>
              <strong className="text-[var(--brand-purple)]">
                {formatUzbekPrice(cart.totalAmount)}
              </strong>
            </div>
            {cart.unavailableItemsCount > 0 ? (
              <p className="mt-3 text-xs font-bold text-[var(--brand-coral)]">
                Mavjud bo‘lmagan mahsulotlarni olib tashlang yoki yangilang.
              </p>
            ) : null}
            {!isCheckoutOpen ? (
              <button
                className="focus-ring mt-5 w-full rounded-xl bg-[var(--brand-purple)] px-5 py-4 font-black text-white disabled:opacity-50"
                disabled={cart.unavailableItemsCount > 0}
                onClick={() => {
                  setIdempotencyKey(crypto.randomUUID());
                  setIsCheckoutOpen(true);
                  setMessage("");
                }}
                type="button"
              >
                Buyurtma berish
              </button>
            ) : null}
          </section>

          {isCheckoutOpen ? (
            <section className="surface mt-5 rounded-[2rem] p-5">
              <h2 className="text-xl font-black">
                Yetkazib berish ma’lumotlari
              </h2>
              <label className="mt-4 block text-sm font-bold">
                Telefon raqami
                <input
                  autoComplete="tel"
                  className="focus-ring mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900"
                  onChange={(event) => {
                    setPhone(event.target.value);
                  }}
                  placeholder="+998901234567"
                  type="tel"
                  value={phone}
                />
              </label>
              <label className="mt-4 block text-sm font-bold">
                Yetkazib berish manzili
                <textarea
                  className="focus-ring mt-2 min-h-24 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900"
                  maxLength={500}
                  onChange={(event) => {
                    setDeliveryAddress(event.target.value);
                  }}
                  placeholder="Viloyat/shahar, ko‘cha va uy raqami"
                  value={deliveryAddress}
                />
              </label>

              <div className="mt-5 border-t border-slate-200 pt-4">
                <h3 className="font-black">Buyurtma tarkibi</h3>
                <ul className="mt-3 grid gap-2 text-sm">
                  {cart.items.map((item) => (
                    <li
                      className="flex justify-between gap-3"
                      key={item.id}
                    >
                      <span>
                        {item.productName} · {item.size}/{item.color} ·{" "}
                        {String(item.quantity)} dona
                      </span>
                      <strong>
                        {formatUzbekPrice(item.subtotal)}
                      </strong>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-right text-lg font-black">
                  Jami: {formatUzbekPrice(cart.totalAmount)}
                </p>
              </div>

              {!telegramMainButtonAvailable ? (
                <button
                  className="focus-ring mt-5 w-full rounded-xl bg-[var(--brand-purple)] px-5 py-4 font-black text-white disabled:opacity-50"
                  disabled={
                    !checkoutValidation.success || isSubmitting
                  }
                  onClick={() => {
                    void submitCheckout();
                  }}
                  type="button"
                >
                  {isSubmitting
                    ? "Yuborilmoqda…"
                    : "Buyurtmani tasdiqlash"}
                </button>
              ) : null}
              <button
                className="focus-ring mt-3 w-full rounded-xl px-5 py-3 font-bold"
                disabled={isSubmitting}
                onClick={() => {
                  setIsCheckoutOpen(false);
                  setIdempotencyKey("");
                  setMessage("");
                }}
                type="button"
              >
                Bekor qilish
              </button>
            </section>
          ) : null}
        </>
      )}
    </main>
  );
}
