const priceFormatter = new Intl.NumberFormat("uz-UZ", {
  maximumFractionDigits: 0,
});

export function formatUzbekPrice(amountInput: unknown): string {
  if (
    typeof amountInput !== "number" ||
    !Number.isSafeInteger(amountInput) ||
    amountInput < 0
  ) {
    throw new Error("Narx manfiy bo‘lmagan butun son bo‘lishi kerak.");
  }

  const amount = amountInput;
  const formatted = priceFormatter.format(amount).replace(/\s/g, " ");

  return `${formatted} so‘m`;
}
