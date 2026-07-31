import { PrismaPg } from "@prisma/adapter-pg";
import { z } from "zod";

import { PrismaClient } from "./generated/prisma/client.js";

const databaseEnvSchema = z.object({
  DATABASE_URL: z
    .string()
    .trim()
    .regex(
      /^postgres(?:ql)?:\/\//,
      "DATABASE_URL PostgreSQL manzili bo‘lishi kerak",
    ),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(20).default(5),
});

const databaseEnv = databaseEnvSchema.parse(process.env);
const databaseUrl = new URL(databaseEnv.DATABASE_URL);
const isSupabasePooler = databaseUrl.hostname.endsWith(
  ".pooler.supabase.com",
);
const isTransactionPooler = isSupabasePooler && databaseUrl.port === "6543";

if (
  process.env.VERCEL === "1" &&
  isSupabasePooler &&
  !isTransactionPooler
) {
  console.warn(
    JSON.stringify({
      event: "database_pool_mode",
      reasonCode: "transaction_pooler_recommended",
    }),
  );
}

const adapter = new PrismaPg({
  connectionString: databaseEnv.DATABASE_URL,
  max: databaseEnv.DATABASE_POOL_MAX,
  connectionTimeoutMillis: 5_000,
  idleTimeoutMillis: 10_000,
  allowExitOnIdle: true,
});

export const prisma = new PrismaClient({ adapter });
