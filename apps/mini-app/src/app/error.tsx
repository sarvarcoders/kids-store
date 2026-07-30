"use client";

import type { ReactNode } from "react";

import { ErrorState } from "@/components/ui/status-state";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): ReactNode {
  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-3 py-5 sm:px-5">
      <ErrorState
        message="Sahifani ochishda xato yuz berdi."
        onRetry={reset}
      />
    </main>
  );
}
