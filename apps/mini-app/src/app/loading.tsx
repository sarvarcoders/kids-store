import type { ReactNode } from "react";

import { LoadingState } from "@/components/ui/status-state";

export default function Loading(): ReactNode {
  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-3 py-5 sm:px-5">
      <LoadingState />
    </main>
  );
}
