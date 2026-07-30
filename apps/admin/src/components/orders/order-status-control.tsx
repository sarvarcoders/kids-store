"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { useAdminAuth } from "@/components/auth/admin-auth-provider";
import { formatAdminOrderStatus } from "@/lib/format/display";

export function OrderStatusControl({
  orderId,
  currentStatus,
  allowedStatuses,
}: {
  orderId: number;
  currentStatus: string;
  allowedStatuses: string[];
}): React.ReactNode {
  const { request } = useAdminAuth();
  const router = useRouter();
  const [status, setStatus] = useState(currentStatus);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const update = async (): Promise<void> => {
    if (
      status === "CANCELLED" &&
      !window.confirm(
        "Buyurtma bekor qilinadi va stock bir marta qaytariladi. Davom etilsinmi?",
      )
    ) {
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      await request(`/api/admin/orders/${String(orderId)}`, {
        method: "PATCH",
        body: { status },
        idempotent: true,
      });
      setMessage("Status muvaffaqiyatli yangilandi.");
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Status yangilanmadi.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="status-control">
      <label>
        Buyurtma statusi
        <select
          disabled={allowedStatuses.length <= 1}
          onChange={(event) => { setStatus(event.target.value); }}
          value={status}
        >
          {allowedStatuses.map((value) => (
            <option key={value} value={value}>
              {formatAdminOrderStatus(value)}
            </option>
          ))}
        </select>
      </label>
      <button
        className="primary-button"
        disabled={busy || status === currentStatus}
        onClick={() => void update()}
        type="button"
      >
        {busy ? "Yangilanmoqda…" : "Statusni yangilash"}
      </button>
      {message ? <p className="hint">{message}</p> : null}
    </div>
  );
}
