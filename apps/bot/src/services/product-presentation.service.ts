import { z } from "zod";

import type { ProductDetails } from "./product.service.js";

const moneyAmountSchema = z.number().int().nonnegative();
const priceFormatter = new Intl.NumberFormat("uz-UZ");

export function formatPrice(amountInput: unknown): string {
  const amount = moneyAmountSchema.parse(amountInput);
  return `${priceFormatter.format(amount)} so‘m`;
}

export function formatProductCaption(product: ProductDetails): string {
  const lines = [`👕 ${product.name}`, `🏷 Kod: ${product.code}`];

  if (
    product.discountPrice !== null &&
    product.discountPrice < product.price
  ) {
    lines.push(
      `💰 Narxi: ${formatPrice(product.price)}`,
      `🔥 Chegirmadagi narxi: ${formatPrice(product.discountPrice)}`,
    );
  } else {
    lines.push(`💰 Narxi: ${formatPrice(product.price)}`);
  }

  if (product.description) {
    lines.push("", product.description);
  }

  lines.push("", "Mavjud variantlar:");

  if (product.variants.length === 0) {
    lines.push("Hozircha variantlar mavjud emas.");
  } else {
    for (const variant of product.variants) {
      const availability =
        variant.stock > 0 ? `${String(variant.stock)} dona` : "qolmagan";
      lines.push(`• ${variant.size} / ${variant.color} — ${availability}`);
    }
  }

  return lines.join("\n");
}
