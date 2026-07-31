import { z } from "zod";

const numericInputTextSchema = z.string().max(32);

export const nonNegativeIntegerInputSchema = z
  .number()
  .int()
  .nonnegative();

export type NumericInputValue = number | "";

export function parseNumericInputValue(value: unknown): NumericInputValue {
  const textResult = numericInputTextSchema.safeParse(value);

  if (!textResult.success || textResult.data === "") {
    return "";
  }

  const numberResult = z.number().safeParse(Number(textResult.data));

  return numberResult.success ? numberResult.data : "";
}
