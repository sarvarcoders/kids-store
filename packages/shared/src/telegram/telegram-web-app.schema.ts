import { z } from "zod";

const telegramPhotoUrlSchema = z.url();
const optionalTelegramPhotoUrlSchema = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return undefined;
    }

    const parsedUrl = telegramPhotoUrlSchema.safeParse(value);
    return parsedUrl.success ? parsedUrl.data : undefined;
  },
  telegramPhotoUrlSchema.optional(),
);

export const telegramWebAppUserSchema = z.object({
  id: z
    .number()
    .int()
    .positive()
    .max(Number.MAX_SAFE_INTEGER),
  is_bot: z.boolean().optional(),
  first_name: z
    .string()
    .max(120)
    .refine((value) => value.trim().length > 0),
  last_name: z.string().max(120).optional(),
  username: z.string().max(64).optional(),
  language_code: z.string().max(35).optional(),
  is_premium: z.boolean().optional(),
  photo_url: optionalTelegramPhotoUrlSchema,
  added_to_attachment_menu: z.boolean().optional(),
  allows_write_to_pm: z.boolean().optional(),
});

export const verifiedTelegramUserDtoSchema = z.object({
  id: z.string().regex(/^[1-9]\d*$/),
  firstName: z.string().trim().min(1).max(120),
  lastName: z.string().trim().min(1).max(120).optional(),
  username: z.string().trim().min(1).max(64).optional(),
  languageCode: z.string().trim().min(1).max(35).optional(),
  isPremium: z.boolean().optional(),
  photoUrl: z.url().optional(),
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
