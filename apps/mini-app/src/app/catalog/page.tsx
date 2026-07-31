import { Suspense, type ReactNode } from "react";

import { CatalogPage } from "@/components/catalog/catalog-page";
import { LoadingState } from "@/components/ui/status-state";

export default function CatalogRoute(): ReactNode {
  return (
    <Suspense
      fallback={
        <main className="mx-auto min-h-screen w-full max-w-3xl px-3 py-5 sm:px-5">
          <LoadingState label="Katalog yuklanmoqda" />
        </main>
      }
    >
      <CatalogPage />
    </Suspense>
  );
}
