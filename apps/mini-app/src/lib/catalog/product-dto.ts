import {
  productDetailDtoSchema,
  productListItemDtoSchema,
  type ProductDetailDto,
  type ProductListItemDto,
} from "@kids-store/shared";

interface ProductImageRecord {
  id: number;
  url: string;
  sortOrder: number;
}

interface ProductVariantRecord {
  id: number;
  size: string;
  color: string;
  stock: number;
}

interface ProductBaseRecord {
  id: number;
  code: string;
  name: string;
  price: number;
  discountPrice: number | null;
  category: {
    id: number;
    name: string;
    slug: string;
  };
}

export interface ProductListRecord extends ProductBaseRecord {
  images: ProductImageRecord[];
  variants: ProductVariantRecord[];
}

export interface ProductDetailRecord extends ProductBaseRecord {
  description: string | null;
  images: ProductImageRecord[];
  variants: ProductVariantRecord[];
}

export function formatProductListItem(
  product: ProductListRecord,
): ProductListItemDto {
  const availableSizes = Array.from(
    new Set(
      product.variants
        .filter((variant) => variant.stock > 0)
        .map((variant) => variant.size),
    ),
  );

  return productListItemDtoSchema.parse({
    id: product.id,
    code: product.code,
    name: product.name,
    price: product.price,
    discountPrice: product.discountPrice,
    category: product.category,
    primaryImage: product.images[0] ?? null,
    availableSizes,
  });
}

export function formatProductDetail(
  product: ProductDetailRecord,
): ProductDetailDto {
  return productDetailDtoSchema.parse({
    id: product.id,
    code: product.code,
    name: product.name,
    description: product.description,
    price: product.price,
    discountPrice: product.discountPrice,
    category: product.category,
    images: product.images,
    variants: product.variants.filter((variant) => variant.stock > 0),
  });
}
