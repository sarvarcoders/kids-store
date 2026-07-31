import {
  productVariantDtoSchema,
  type ProductVariantDto,
} from "@kids-store/shared/catalog";
import { z } from "zod";

const variantsSchema = z.array(productVariantDtoSchema);
const selectionSchema = z.object({
  size: z.string().trim().min(1).max(50),
  color: z.string().trim().min(1).max(80),
});

export function getAvailableColorsForSize(
  variantsInput: unknown,
  sizeInput: unknown,
): string[] {
  const variants = variantsSchema.parse(variantsInput);
  const size = z.string().trim().min(1).max(50).parse(sizeInput);

  return Array.from(
    new Set(
      variants
        .filter((variant) => variant.size === size)
        .map((variant) => variant.color),
    ),
  );
}

export function findSelectedProductVariant(
  variantsInput: unknown,
  selectionInput: unknown,
): ProductVariantDto | null {
  const variants = variantsSchema.parse(variantsInput);
  const selection = selectionSchema.parse(selectionInput);

  return (
    variants.find(
      (variant) =>
        variant.size === selection.size &&
        variant.color === selection.color,
    ) ?? null
  );
}

export function getMaximumSelectableQuantity(
  stockInput: unknown,
): number {
  const stock = z.number().int().positive().parse(stockInput);
  return Math.min(5, stock);
}
