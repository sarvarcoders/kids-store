import { z } from "zod";

const POSTGRES_INTEGER_MAX = 2_147_483_647;
const persistedProductIntegerSchema = z
  .number()
  .int()
  .min(0)
  .max(POSTGRES_INTEGER_MAX);
const productIntegerInputSchema = z
  .string()
  .regex(/^\d+$/, "Musbat yoki 0 bo‘lgan butun son kiriting")
  .transform((value) => Number(value))
  .pipe(persistedProductIntegerSchema);

export function formatProductIntegerInput(valueInput: unknown): string {
  return String(persistedProductIntegerSchema.parse(valueInput));
}

export function formatOptionalProductIntegerInput(
  valueInput: unknown,
): string {
  if (valueInput === null || valueInput === undefined) {
    return "";
  }

  return formatProductIntegerInput(valueInput);
}

export function getProductIntegerPreview(valueInput: unknown): number {
  const value = z.string().safeParse(valueInput);

  if (!value.success || value.data.length === 0) {
    return 0;
  }

  const parsed = productIntegerInputSchema.safeParse(value.data);

  return parsed.success ? parsed.data : 0;
}
