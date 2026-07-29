import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { z } from "zod";

config({
  path: fileURLToPath(new URL("../../../../.env", import.meta.url)),
  quiet: true,
});

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  TELEGRAM_BOT_TOKEN: z
    .string()
    .trim()
    .min(1, "TELEGRAM_BOT_TOKEN kiritilishi shart"),
});

export const env = envSchema.parse(process.env);
