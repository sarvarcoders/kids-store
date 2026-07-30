import type { ProductListItemDto } from "@kids-store/shared";
import type { ReactNode } from "react";

import { ProductCard } from "./product-card";

export function ProductGrid({
  products,
}: {
  products: ProductListItemDto[];
}): ReactNode {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
