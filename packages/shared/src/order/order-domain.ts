import { z } from "zod";

const priceInputSchema = z.object({
  price: z.number().int().nonnegative(),
  discountPrice: z.number().int().nonnegative().nullable(),
});

export function calculateEffectivePrice(input: unknown): number {
  const product = priceInputSchema.parse(input);

  return product.discountPrice !== null &&
    product.discountPrice < product.price
    ? product.discountPrice
    : product.price;
}
