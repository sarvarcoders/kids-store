import type { CatalogProductDto } from "@kids-store/shared/catalog";
import { memo, type ReactNode } from "react";

import { ProductCard } from "./product-card";

export const ProductGrid = memo(function ProductGrid({
  preloadFirstImage = false,
  products,
}: {
  preloadFirstImage?: boolean;
  products: CatalogProductDto[];
}): ReactNode {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {products.map((product, index) => (
        <ProductCard
          key={product.id}
          preloadImage={preloadFirstImage && index === 0}
          product={product}
        />
      ))}
    </div>
  );
});
