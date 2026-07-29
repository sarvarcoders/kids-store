import { prisma } from "@kids-store/database";

import { databaseIdSchema } from "../config/validation.js";
import { logger } from "../config/logger.js";

export interface ProductImageDetails {
  url: string;
  sortOrder: number;
}

export interface ProductVariantDetails {
  id: number;
  size: string;
  color: string;
  stock: number;
}

export interface ProductDetails {
  id: number;
  code: string;
  name: string;
  description: string | null;
  price: number;
  discountPrice: number | null;
  images: ProductImageDetails[];
  variants: ProductVariantDetails[];
}

export async function findActiveProductById(
  productIdInput: unknown,
): Promise<ProductDetails | null> {
  const productId = databaseIdSchema.parse(productIdInput);

  try {
    return await prisma.product.findFirst({
      where: {
        id: productId,
        isActive: true,
      },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        price: true,
        discountPrice: true,
        images: {
          select: {
            url: true,
            sortOrder: true,
          },
          orderBy: {
            sortOrder: "asc",
          },
        },
        variants: {
          select: {
            id: true,
            size: true,
            color: true,
            stock: true,
          },
          orderBy: [{ size: "asc" }, { color: "asc" }],
        },
      },
    });
  } catch (error) {
    logger.error("Mahsulotni bazadan olishda xato yuz berdi", error, {
      productId,
    });
    throw new Error("Mahsulot ma’lumotlarini olish imkoni bo‘lmadi", {
      cause: error,
    });
  }
}
