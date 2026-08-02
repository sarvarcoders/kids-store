import type { CatalogProductDto } from "@kids-store/shared/catalog";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { formatUzbekPrice } from "@/lib/format/price";
import { PRODUCT_IMAGE_BLUR_DATA_URL } from "@/lib/images/placeholder";

export function ProductCard({
  preloadImage = false,
  product,
}: {
  preloadImage?: boolean;
  product: CatalogProductDto;
}): ReactNode {
  const hasDiscount =
    product.discountPrice !== undefined &&
    product.discountPrice < product.price;
  const currentPrice = hasDiscount
    ? product.discountPrice
    : product.price;
  const sizes = product.availableSizes.slice(0, 3).join(", ");
  const additionalSizeCount = Math.max(
    product.availableSizes.length - 3,
    0,
  );

  return (
    <article className="surface group overflow-hidden rounded-[1.4rem] p-2 shadow-[0_12px_30px_rgba(72,48,120,0.08)] transition-transform duration-200 hover:-translate-y-0.5">
      <Link
        aria-label={`${product.name} mahsulotini ko‘rish`}
        className="focus-ring block rounded-[1.05rem]"
        href={`/products/${String(product.id)}`}
        prefetch={false}
      >
        <div className="image-panel relative aspect-[4/5] overflow-hidden rounded-[1.05rem]">
          {product.imageUrl ? (
            <Image
              alt={`${product.name} rasmi`}
              blurDataURL={PRODUCT_IMAGE_BLUR_DATA_URL}
              className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              fill
              placeholder="blur"
              preload={preloadImage}
              sizes="(max-width: 768px) 50vw, 33vw"
              src={product.imageUrl}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-5xl">
              👕
            </div>
          )}
          {hasDiscount ? (
            <span className="absolute left-2 top-2 rounded-full bg-[var(--brand-coral)] px-2.5 py-1 text-[0.65rem] font-black uppercase tracking-wide text-white">
              Chegirma
            </span>
          ) : null}
        </div>

        <div className="px-1 pb-2 pt-3">
          <p className="text-muted text-[0.68rem] font-bold uppercase tracking-[0.12em]">
            {product.categoryName}
          </p>
          <h3 className="mt-1 line-clamp-2 min-h-10 text-sm font-extrabold leading-5">
            {product.name}
          </h3>
          <div className="mt-2">
            {hasDiscount ? (
              <p className="text-muted text-[0.72rem] line-through">
                {formatUzbekPrice(product.price)}
              </p>
            ) : null}
            <p className="text-sm font-black text-[var(--brand-purple)]">
              {formatUzbekPrice(currentPrice)}
            </p>
          </div>
          <p className="text-muted mt-2 truncate text-[0.72rem]">
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
