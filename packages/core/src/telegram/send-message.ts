import { z } from "zod";

const botTokenSchema = z
  .string()
  .min(1)
  .refine((value) => value === value.trim());
const chatIdSchema = z.string().trim().regex(/^-?[1-9]\d*$/);
const textSchema = z.string().min(1).max(4_096);
const telegramResponseSchema = z.object({
  ok: z.boolean(),
});

export async function sendTelegramTextMessage(input: {
  botToken: string;
  chatId: string;
  text: string;
}): Promise<void> {
  const botToken = botTokenSchema.parse(input.botToken);
  const chatId = chatIdSchema.parse(input.chatId);
  const text = textSchema.parse(input.text);
  const response = await fetch(
    `https://api.telegram.org/bot${botToken}/sendMessage`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text,
      }),
      cache: "no-store",
    },
  );
  const payload: unknown = await response.json();
  const parsed = telegramResponseSchema.safeParse(payload);

  if (!response.ok || !parsed.success || !parsed.data.ok) {
    throw new Error("TELEGRAM_MESSAGE_REJECTED");
  }
}
