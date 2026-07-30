"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useAdminAuth } from "@/components/auth/admin-auth-provider";

export function ProductActions({
  id,
  isActive,
}: {
  id: number;
  isActive: boolean;
}): React.ReactNode {
  const { request } = useAdminAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const toggle = async (): Promise<void> => {
    setBusy(true);

    try {
      await request(`/api/admin/products/${String(id)}/active`, {
        method: "PATCH",
        body: { isActive: !isActive },
        idempotent: true,
      });
      router.refresh();
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : "Amal bajarilmadi.",
      );
    } finally {
      setBusy(false);
    }
  };

  const publish = async (): Promise<void> => {
    setBusy(true);

    try {
      const result = await request<{
        data: { telegramMessageId: number; postUrl: string | null };
      }>(`/api/admin/products/${String(id)}/publish`, {
        method: "POST",
        idempotent: true,
      });
      window.alert(
        result.data.postUrl
          ? `Post yuborildi: ${result.data.postUrl}`
          : `Post yuborildi. Message ID: ${String(result.data.telegramMessageId)}`,
      );
      router.refresh();
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : "Publish bajarilmadi.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="row-actions">
      <Link
        className="table-action"
        href={`/products/${String(id)}/edit`}
      >
        Tahrirlash
      </Link>
      <button
        className="table-action"
        disabled={busy || !isActive}
        onClick={() => void publish()}
        type="button"
      >
        Publish
      </button>
      <button
        className="table-action"
        disabled={busy}
        onClick={() => void toggle()}
        type="button"
      >
        {isActive ? "Arxivlash" : "Faollashtirish"}
      </button>
    </div>
  );
}
