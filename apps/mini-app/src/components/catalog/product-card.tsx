import type { CatalogProductDto } from "@kids-store/shared/catalog";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { formatUzbekPrice } from "@/lib/format/price";
import { PRODUCT_IMAGE_BLUR_DATA_URL } from "@/lib/images/placeholder";

export function ProductCard({
  product,
}: {
  product: CatalogProductDto;
}): ReactNode {
  const hasDiscount =
    product.discountPrice !== undefined &&
    product.discountPrice < product.price;
  const currentPrice = hasDiscount && product.discountPrice !== undefined
    ? product.discountPrice
    : product.price;
  const sizes = product.availableSizes.slice(0, 3).join(", ");
  const additionalSizeCount = Math.max(
    product.availableSizes.length - 3,
    0,
  );
  const discountPercent = hasDiscount
    ? Math.max(
        1,
        Math.round(((product.price - currentPrice) / product.price) * 100),
      )
    : 0;

  return (
    <article className="product-card surface group overflow-hidden rounded-[1.5rem] p-2">
      <Link
        aria-label={`${product.name} mahsulotini ko‘rish`}
        className="focus-ring block rounded-[1.05rem]"
        href={`/products/${String(product.id)}`}
        prefetch={false}
      >
        <div className="image-panel relative aspect-[4/5] overflow-hidden rounded-[1.15rem]">
          {product.imageUrl ? (
            <Image
              alt={`${product.name} rasmi`}
              blurDataURL={PRODUCT_IMAGE_BLUR_DATA_URL}
              className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              fill
              loading="lazy"
              placeholder="blur"
              quality={70}
              sizes="(max-width: 768px) 50vw, 33vw"
              src={product.imageUrl}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-5xl">
              👕
            </div>
          )}
          {hasDiscount ? (
            <span className="sale-badge absolute left-2 top-2">
              −{String(discountPercent)}%
            </span>
          ) : null}
          <span aria-hidden="true" className="product-open-hint">↗</span>
        </div>

        <div className="px-1 pb-2 pt-3">
          <p className="text-muted text-[0.65rem] font-extrabold uppercase tracking-[0.12em]">
            {product.categoryName}
          </p>
          <h3 className="mt-1 line-clamp-2 min-h-10 text-sm font-extrabold leading-5">
            {product.name}
          </h3>
          <div className="mt-2 flex min-h-10 items-end justify-between gap-1">
            <div>
              {hasDiscount ? (
                <p className="text-muted text-[0.72rem] line-through">
                  {formatUzbekPrice(product.price)}
                </p>
              ) : null}
              <p className="text-sm font-black text-[var(--brand-purple)]">
                {formatUzbekPrice(currentPrice)}
              </p>
            </div>
            <span aria-hidden="true" className="product-dot">●</span>
          </div>
          <p className="size-preview text-muted mt-2 truncate text-[0.7rem]">
            O‘lcham: {sizes}
            {additionalSizeCount > 0
              ? ` +${String(additionalSizeCount)}`
              : ""}
          </p>
        </div>
      </Link>
    </article>
  );
}
