"use client";

import type {
  OrderDetailDto,
} from "@kids-store/shared/cart";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { useTelegram } from "@/components/telegram/telegram-provider";
import {
  ErrorState,
  LoadingState,
} from "@/components/ui/status-state";
import { requestMiniAppApiJson } from "@/lib/api/client";
import { formatUzbekPrice } from "@/lib/format/price";
import { formatMiniAppOrderStatus } from "@/lib/format/order-status";
import { showTelegramBackButton } from "@/lib/telegram/web-app";

interface OrderDetailResponse {
  data: OrderDetailDto;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Buyurtmani yuklab bo‘lmadi.";
}

export function OrderDetail({
  orderId,
}: {
  orderId: string;
}): ReactNode {
  const router = useRouter();
  const {
    initializationError,
    isReady,
    readInitData,
    retryInitialization,
  } = useTelegram();
  const [order, setOrder] = useState<OrderDetailDto | null>(null);
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

    async function loadOrder(): Promise<void> {
      setIsLoading(true);
      setError("");

      try {
        const response = await requestMiniAppApiJson<OrderDetailResponse>(
          `/api/orders/${encodeURIComponent(orderId)}`,
          readInitData,
          { signal: controller.signal },
        );
        setOrder(response.data);
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

    void loadOrder();

    return () => {
      controller.abort();
    };
  }, [isReady, orderId, readInitData, retryVersion]);

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
        <LoadingState label="Buyurtma yuklanmoqda" />
      </main>
    );
  }

  if (error || !order) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-3xl px-3 py-5 sm:px-5">
        <ErrorState
          message={error || "Buyurtma topilmadi."}
          onRetry={() => {
            setRetryVersion((value) => value + 1);
          }}
        />
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-3 py-5 sm:px-5">
      <Link
        className="surface focus-ring inline-flex rounded-full px-4 py-2 text-sm font-extrabold"
        href="/orders"
        prefetch={false}
      >
        ← Buyurtmalar
      </Link>
      <section className="surface mt-4 rounded-[2rem] p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="eyebrow">Buyurtma</p>
            <h1 className="text-2xl font-black">
              #{String(order.id)}
            </h1>
          </div>
          <span className="rounded-full bg-[var(--soft-panel)] px-3 py-1 text-xs font-bold">
            {formatMiniAppOrderStatus(order.status)}
          </span>
        </div>

        <dl className="mt-5 grid gap-3 text-sm">
          <div>
            <dt className="text-muted">Telefon</dt>
            <dd className="font-bold">{order.phone}</dd>
          </div>
          <div>
            <dt className="text-muted">Yetkazib berish manzili</dt>
            <dd className="font-bold">{order.deliveryAddress}</dd>
          </div>
        </dl>

        <h2 className="mt-6 font-black">Mahsulotlar</h2>
        <ul className="mt-3 grid gap-3" role="list">
          {order.items.map((item) => (
            <li
              className="rounded-2xl bg-[var(--soft-panel)] p-4"
              key={item.id}
            >
              <p className="font-black">{item.productName}</p>
              <p className="text-muted mt-1 text-xs">
                {item.size} / {item.color} · {String(item.quantity)} dona
              </p>
              <div className="mt-2 flex justify-between gap-3 text-sm">
                <span>{formatUzbekPrice(item.unitPrice)} / dona</span>
                <strong>{formatUzbekPrice(item.subtotal)}</strong>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-5 flex justify-between gap-3 border-t border-slate-200 pt-4 text-lg">
          <span className="font-black">Jami</span>
          <strong className="text-[var(--brand-purple)]">
            {formatUzbekPrice(order.totalAmount)}
          </strong>
        </div>
      </section>
    </main>
  );
}
