import { z } from "zod";

import { phoneSchema } from "./phone.validator.js";

export const telegramIdSchema = z.coerce.bigint().positive();

export const customerSchema = z.object({
  telegramUserId: telegramIdSchema,
  username: z.string().trim().min(1).max(32).optional(),
  firstName: z.string().trim().min(1).max(120),
  phone: phoneSchema,
});

export type CustomerInput = z.infer<typeof customerSchema>;
export type TelegramId = z.infer<typeof telegramIdSchema>;
