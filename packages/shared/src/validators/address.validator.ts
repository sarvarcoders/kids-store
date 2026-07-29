import { z } from "zod";

export const addressSchema = z
  .string()
  .trim()
  .min(5, "Manzil kamida 5 ta belgidan iborat bo‘lishi kerak")
  .max(500, "Manzil 500 ta belgidan oshmasligi kerak");

export type Address = z.infer<typeof addressSchema>;
