"use client";

import { ErrorState } from "@/components/ui/page-state";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): React.ReactNode {
  return (
    <>
      <ErrorState />
      <button
        className="primary-button"
        onClick={reset}
        type="button"
      >
        Qayta urinish
      </button>
    </>
  );
}
