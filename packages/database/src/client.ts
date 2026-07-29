import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { z } from "zod";

import { PrismaClient } from "./generated/prisma/client.js";

config({
  path: fileURLToPath(new URL("../../../.env", import.meta.url)),
  quiet: true,
});

const databaseEnvSchema = z.object({
  DATABASE_URL: z
    .string()
    .regex(/^postgres(?:ql)?:\/\//, "DATABASE_URL PostgreSQL manzili bo‘lishi kerak"),
});

const databaseEnv = databaseEnvSchema.parse(process.env);
const adapter = new PrismaPg({
  connectionString: databaseEnv.DATABASE_URL,
});

export const prisma = new PrismaClient({ adapter });
