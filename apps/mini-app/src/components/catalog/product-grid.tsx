import type { CatalogProductDto } from "@kids-store/shared/catalog";
import { memo, type ReactNode } from "react";

import { ProductCard } from "./product-card";

export const ProductGrid = memo(function ProductGrid({
  products,
}: {
  products: CatalogProductDto[];
}): ReactNode {
  return (
    <div className="product-grid grid grid-cols-2 gap-3 sm:grid-cols-3">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
});
