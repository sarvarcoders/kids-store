import { z } from "zod";

function normalizePhone(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const compact = value.trim().replace(/[\s()-]/g, "");

  if (/^\d{9}$/.test(compact)) {
    return `+998${compact}`;
  }

  if (/^998\d{9}$/.test(compact)) {
    return `+${compact}`;
  }

  return compact;
}

export const phoneSchema = z.preprocess(
  normalizePhone,
  z
    .string()
    .regex(
      /^\+998\d{9}$/,
      "Telefon raqami +998901234567 formatida bo‘lishi kerak",
    ),
);

export type Phone = z.infer<typeof phoneSchema>;
