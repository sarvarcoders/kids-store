import { z } from "zod";

export const databaseIdSchema = z.coerce
  .number()
  .int()
  .positive()
  .max(2_147_483_647);
