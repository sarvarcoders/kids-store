import "server-only";

import { prisma } from "@kids-store/database";
import {
  categoryDtoSchema,
  type CategoryDto,
  type ProductDetailDto,
  type ProductListItemDto,
  type ProductQuery,
} from "@kids-store/shared";

import {
  formatProductDetail,
  formatProductListItem,
} from "./product-dto";

const categorySelect = {
  id: true,
  name: true,
  slug: true,
} as const;

const imageSelect = {
  id: true,
  url: true,
  sortOrder: true,
} as const;

const variantSelect = {
  id: true,
  size: true,
  color: true,
  stock: true,
} as const;

export interface ProductPage {
  data: ProductListItemDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
  };
}

export async function listCatalogCategories(): Promise<CategoryDto[]> {
  const categories = await prisma.category.findMany({
    where: {
      products: {
        some: {
          isActive: true,
          variants: {
            some: {
              stock: {
                gt: 0,
              },
            },
          },
        },
      },
    },
    select: categorySelect,
    orderBy: {
      name: "asc",
    },
  });

  return categories.map((category) => categoryDtoSchema.parse(category));
}

export async function listCatalogProducts(
  query: ProductQuery,
): Promise<ProductPage> {
  const where = {
    isActive: true,
    variants: {
      some: {
        stock: {
          gt: 0,
        },
      },
    },
    ...(query.category === undefined
      ? {}
      : {
          category: {
            slug: query.category,
          },
        }),
    ...(query.discountOnly
      ? {
          discountPrice: {
            not: null,
          },
        }
      : {}),
    ...(query.search === undefined
      ? {}
      : {
          OR: [
            {
              name: {
                contains: query.search,
                mode: "insensitive" as const,
              },
            },
            {
              code: {
                contains: query.search,
                mode: "insensitive" as const,
              },
            },
            {
              description: {
                contains: query.search,
                mode: "insensitive" as const,
              },
            },
          ],
        }),
  };
  const skip = (query.page - 1) * query.limit;
  const [total, products] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      select: {
        id: true,
        code: true,
        name: true,
        price: true,
        discountPrice: true,
        category: {
          select: categorySelect,
        },
        images: {
          select: imageSelect,
          orderBy: {
            sortOrder: "asc",
          },
          take: 1,
        },
        variants: {
          where: {
            stock: {
              gt: 0,
            },
          },
          select: variantSelect,
          orderBy: [{ size: "asc" }, { color: "asc" }],
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip,
      take: query.limit,
    }),
  ]);
  const totalPages = total === 0 ? 0 : Math.ceil(total / query.limit);

  return {
    data: products.map(formatProductListItem),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages,
      hasPreviousPage: query.page > 1,
      hasNextPage: query.page < totalPages,
    },
  };
}

export async function getCatalogProductById(
  productId: number,
): Promise<ProductDetailDto | null> {
  const product = await prisma.product.findFirst({
    where: {
      id: productId,
      isActive: true,
      variants: {
        some: {
          stock: {
            gt: 0,
          },
        },
      },
    },
    select: {
      id: true,
      code: true,
      name: true,
      description: true,
      price: true,
      discountPrice: true,
      category: {
        select: categorySelect,
      },
      images: {
        select: imageSelect,
        orderBy: {
          sortOrder: "asc",
        },
      },
      variants: {
        where: {
          stock: {
            gt: 0,
          },
        },
        select: variantSelect,
        orderBy: [{ size: "asc" }, { color: "asc" }],
      },
    },
  });

  return product ? formatProductDetail(product) : null;
}
