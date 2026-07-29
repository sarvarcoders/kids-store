import { z } from "zod";

export const telegramIdSchema = z.coerce.bigint().positive();

export type TelegramId = z.infer<typeof telegramIdSchema>;
