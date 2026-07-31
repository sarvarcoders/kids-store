import type { ProductVariantDto } from "@kids-store/shared/catalog";

interface ProductSelection {
  color: string;
  size: string;
}

function normalizeSelectionValue(
  value: string,
  maximumLength: number,
): string {
  const normalized = value.trim();

  if (normalized.length === 0 || normalized.length > maximumLength) {
    throw new Error("Mahsulot varianti qiymati noto‘g‘ri.");
  }

  return normalized;
}

export function getAvailableColorsForSize(
  variants: readonly ProductVariantDto[],
  sizeInput: string,
): string[] {
  const size = normalizeSelectionValue(sizeInput, 50);

  return Array.from(
    new Set(
      variants
        .filter((variant) => variant.size === size)
        .map((variant) => variant.color),
    ),
  );
}

export function findSelectedProductVariant(
  variants: readonly ProductVariantDto[],
  selectionInput: ProductSelection,
): ProductVariantDto | null {
  const selection = {
    size: normalizeSelectionValue(selectionInput.size, 50),
    color: normalizeSelectionValue(selectionInput.color, 80),
  };

  return (
    variants.find(
      (variant) =>
        variant.size === selection.size &&
        variant.color === selection.color,
    ) ?? null
  );
}

export function getMaximumSelectableQuantity(
  stockInput: number,
): number {
  if (!Number.isInteger(stockInput) || stockInput <= 0) {
    throw new Error("Mahsulot qoldig‘i noto‘g‘ri.");
  }

  const stock = stockInput;
  return Math.min(5, stock);
}
