import { z } from "zod";

import { prisma } from "../src/client.js";

const httpsUrlSchema = z
  .url()
  .refine((value) => value.startsWith("https://"), {
    message: "Rasm URL HTTPS bo‘lishi kerak",
  });

const seedDataSchema = z.object({
  categories: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(120),
        slug: z.string().trim().min(1).max(160),
      }),
    )
    .min(1),
  product: z.object({
    code: z.string().trim().min(1).max(64),
    name: z.string().trim().min(1).max(160),
    slug: z.string().trim().min(1).max(200),
    description: z.string().trim().min(1),
    price: z.number().int().nonnegative(),
    discountPrice: z.number().int().nonnegative().nullable(),
    isActive: z.boolean(),
  }),
  image: z.object({
    url: httpsUrlSchema,
    sortOrder: z.number().int().nonnegative(),
  }),
  variants: z
    .array(
      z.object({
        size: z.string().trim().min(1).max(50),
        color: z.string().trim().min(1).max(80),
        stock: z.number().int().nonnegative(),
      }),
    )
    .min(1)
    .superRefine((variants, context) => {
      const uniqueVariants = new Set(
        variants.map((variant) => `${variant.size}\u0000${variant.color}`),
      );

      if (uniqueVariants.size !== variants.length) {
        context.addIssue({
          code: "custom",
          message: "Variant size va color juftliklari takrorlanmasligi kerak",
        });
      }
    }),
});

const seedData = seedDataSchema.parse({
  categories: [
    {
      name: "O‘g‘il bolalar kiyimi",
      slug: "boys-clothing",
    },
    {
      name: "Qiz bolalar kiyimi",
      slug: "qiz-bolalar-kiyimi",
    },
    {
      name: "Bolalar oyoq kiyimi",
      slug: "bolalar-oyoq-kiyimi",
    },
    {
      name: "Sumka va aksessuarlar",
      slug: "sumka-va-aksessuarlar",
    },
  ],
  product: {
    code: "KS-0001",
    name: "Bolalar uchun sport kostyumi",
    slug: "bolalar-sport-kostyumi",
    description:
      "Yumshoq matoli, kundalik kiyish uchun qulay bolalar sport kostyumi.",
    price: 249_000,
    discountPrice: 199_000,
    isActive: true,
  },
  image: {
    url: "https://placehold.co/1200x1200/png?text=Kids%20Store%20KS-0001",
    sortOrder: 0,
  },
  variants: [
    { size: "98", color: "Ko‘k", stock: 5 },
    { size: "104", color: "Ko‘k", stock: 4 },
    { size: "110", color: "Qora", stock: 3 },
    { size: "116", color: "Qora", stock: 2 },
  ],
});

interface SeedSummary {
  productId: number;
  code: string;
  imageCount: number;
  variantCount: number;
}

async function seedDatabase(): Promise<SeedSummary> {
  return prisma.$transaction(async (transaction) => {
    const categories: { id: number; slug: string }[] = [];

    for (const categoryInput of seedData.categories) {
      categories.push(
        await transaction.category.upsert({
          where: {
            slug: categoryInput.slug,
          },
          update: {
            name: categoryInput.name,
          },
          create: categoryInput,
        }),
      );
    }

    const category = categories.find(
      (item) => item.slug === "boys-clothing",
    );

    if (!category) {
      throw new Error("Seed product kategoriyasi topilmadi.");
    }

    const product = await transaction.product.upsert({
      where: {
        code: seedData.product.code,
      },
      update: {
        ...seedData.product,
        categoryId: category.id,
      },
      create: {
        ...seedData.product,
        categoryId: category.id,
      },
    });

    await transaction.productImage.upsert({
      where: {
        productId_sortOrder: {
          productId: product.id,
          sortOrder: seedData.image.sortOrder,
        },
      },
      update: {
        url: seedData.image.url,
      },
      create: {
        ...seedData.image,
        productId: product.id,
      },
    });

    for (const variant of seedData.variants) {
      await transaction.productVariant.upsert({
        where: {
          productId_size_color: {
            productId: product.id,
            size: variant.size,
            color: variant.color,
          },
        },
        update: {
          stock: variant.stock,
        },
        create: {
          ...variant,
          productId: product.id,
        },
      });
    }

    const [imageCount, variantCount] = await Promise.all([
      transaction.productImage.count({
        where: {
          productId: product.id,
        },
      }),
      transaction.productVariant.count({
        where: {
          productId: product.id,
        },
      }),
    ]);

    return {
      productId: product.id,
      code: product.code,
      imageCount,
      variantCount,
    };
  });
}

async function main(): Promise<void> {
  const summary = await seedDatabase();

  console.log("Seed muvaffaqiyatli yakunlandi.");
  console.log(`Product ID: ${String(summary.productId)}`);
  console.log(`Code: ${summary.code}`);
  console.log(`Rasmlar soni: ${String(summary.imageCount)}`);
  console.log(`Variantlar soni: ${String(summary.variantCount)}`);
}

void main()
  .catch((error: unknown) => {
    const message =
      error instanceof z.ZodError
        ? "Seed ma’lumotlari validatsiyadan o‘tmadi."
        : "Database seed bajarilmadi.";

    console.error(message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
