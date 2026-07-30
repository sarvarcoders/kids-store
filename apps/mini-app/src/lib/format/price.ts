import { z } from "zod";

const moneySchema = z.number().int().nonnegative();
const priceFormatter = new Intl.NumberFormat("uz-UZ", {
  maximumFractionDigits: 0,
});

export function formatUzbekPrice(amountInput: unknown): string {
  const amount = moneySchema.parse(amountInput);
  const formatted = priceFormatter.format(amount).replace(/\s/g, " ");

  return `${formatted} so‘m`;
}
