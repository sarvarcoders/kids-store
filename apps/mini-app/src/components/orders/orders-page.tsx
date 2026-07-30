"use client";

import {
  formatOrderStatus,
  orderListResponseSchema,
  type OrderListItemDto,
  type PaginationDto,
} from "@kids-store/shared";
import Link from "next/link";
import {
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { useTelegram } from "@/components/telegram/telegram-provider";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/ui/status-state";
import { fetchMiniAppApi } from "@/lib/api/client";
import { formatUzbekPrice } from "@/lib/format/price";

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Buyurtmalarni yuklab bo‘lmadi.";
}

function formatOrderDate(value: string): string {
  return new Intl.DateTimeFormat("uz-UZ", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function OrdersPage(): ReactNode {
  const {
    initializationError,
    isReady,
    readInitData,
    retryInitialization,
  } = useTelegram();
  const [orders, setOrders] = useState<OrderListItemDto[]>([]);
  const [pagination, setPagination] = useState<PaginationDto | null>(
    null,
  );
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryVersion, setRetryVersion] = useState(0);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    const controller = new AbortController();

    async function loadOrders(): Promise<void> {
      setIsLoading(true);
      setError("");

      try {
        const response = await fetchMiniAppApi(
          `/api/orders?page=${String(page)}&limit=10`,
          readInitData,
          orderListResponseSchema,
          controller.signal,
        );
        setOrders(response.data);
        setPagination(response.pagination);
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

    void loadOrders();

    return () => {
      controller.abort();
    };
  }, [isReady, page, readInitData, retryVersion]);

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

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-3 py-5 sm:px-5">
      <p className="eyebrow">Tarix</p>
      <h1 className="text-2xl font-black">Buyurtmalarim</h1>

      {!isReady || isLoading ? (
        <div className="mt-5">
          <LoadingState label="Buyurtmalar yuklanmoqda" />
        </div>
      ) : error ? (
        <div className="mt-5">
          <ErrorState
            message={error}
            onRetry={() => {
              setRetryVersion((value) => value + 1);
            }}
          />
        </div>
      ) : orders.length === 0 ? (
        <div className="mt-5">
          <EmptyState
            description="Birinchi buyurtmangiz shu yerda ko‘rinadi."
            title="Buyurtmalar yo‘q"
          />
        </div>
      ) : (
        <>
          <ul className="mt-5 grid gap-3" role="list">
            {orders.map((order) => (
              <li key={order.id}>
                <Link
                  className="surface focus-ring block rounded-3xl p-5 no-underline"
                  href={`/orders/${String(order.id)}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black">
                        Buyurtma #{String(order.id)}
                      </p>
                      <p className="text-muted mt-1 text-xs">
                        {formatOrderDate(order.createdAt)}
                      </p>
                    </div>
                    <span className="rounded-full bg-[var(--soft-panel)] px-3 py-1 text-xs font-bold">
                      {formatOrderStatus(order.status)}
                    </span>
                  </div>
                  <div className="mt-4 flex items-end justify-between gap-3">
                    <span className="text-muted text-sm">
                      {String(order.productsCount)} xil mahsulot
                    </span>
                    <strong className="text-[var(--brand-purple)]">
                      {formatUzbekPrice(order.totalAmount)}
                    </strong>
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          {pagination &&
          (pagination.hasPreviousPage || pagination.hasNextPage) ? (
            <nav
              aria-label="Buyurtma sahifalari"
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
    </main>
  );
}
