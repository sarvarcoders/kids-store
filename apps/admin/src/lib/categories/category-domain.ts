import { z } from "zod";

export function canHardDeleteCategory(
  productCountInput: unknown,
): boolean {
  const productCount = z
    .number()
    .int()
    .nonnegative()
    .parse(productCountInput);

  return productCount === 0;
}
