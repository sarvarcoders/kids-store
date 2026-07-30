import { z } from "zod";

export const telegramWebAppUserSchema = z.object({
  id: z.number().int().positive(),
  first_name: z.string().trim().min(1).max(120),
  last_name: z.string().trim().min(1).max(120).optional(),
  username: z.string().trim().min(1).max(32).optional(),
  language_code: z.string().trim().min(2).max(16).optional(),
  is_premium: z.boolean().optional(),
  photo_url: z
    .url()
    .refine((value) => value.startsWith("https://"))
    .optional(),
});

export const verifiedTelegramUserDtoSchema = z.object({
  id: z.string().regex(/^[1-9]\d*$/),
  firstName: z.string().trim().min(1).max(120),
  lastName: z.string().trim().min(1).max(120).optional(),
  username: z.string().trim().min(1).max(32).optional(),
  languageCode: z.string().trim().min(2).max(16).optional(),
  isPremium: z.boolean().optional(),
  isDevelopmentMock: z.boolean(),
});

export const authSessionResponseSchema = z.object({
  data: z.object({
    user: verifiedTelegramUserDtoSchema,
  }),
});

export type AuthSessionResponse = z.infer<typeof authSessionResponseSchema>;
export type TelegramWebAppUser = z.infer<
  typeof telegramWebAppUserSchema
>;
export type VerifiedTelegramUserDto = z.infer<
  typeof verifiedTelegramUserDtoSchema
>;
