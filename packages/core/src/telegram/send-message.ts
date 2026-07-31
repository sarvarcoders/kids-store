import { z } from "zod";

const botTokenSchema = z
  .string()
  .min(1)
  .refine((value) => value === value.trim());
const chatIdSchema = z.string().trim().regex(/^-?[1-9]\d*$/);
const textSchema = z.string().min(1).max(4_096);
const telegramResponseSchema = z.object({
  ok: z.boolean(),
  parameters: z
    .object({
      retry_after: z.number().int().positive().max(10).optional(),
    })
    .optional(),
});
const deliveryOptionsSchema = z.object({
  maxAttempts: z.number().int().min(1).max(5).default(3),
  baseDelayMs: z.number().int().nonnegative().max(5_000).default(250),
});

export interface TelegramMessageDeliveryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  fetcher?: typeof fetch;
  sleep?: (delayMs: number) => Promise<void>;
}

function sleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

function getRetryDelayMs(
  attempt: number,
  baseDelayMs: number,
  retryAfterSeconds?: number,
): number {
  const exponentialDelay = baseDelayMs * 2 ** (attempt - 1);
  const telegramDelay = (retryAfterSeconds ?? 0) * 1_000;

  return Math.max(exponentialDelay, telegramDelay);
}

export async function sendTelegramTextMessage(input: {
  botToken: string;
  chatId: string;
  text: string;
}, optionsInput: TelegramMessageDeliveryOptions = {}): Promise<void> {
  const botToken = botTokenSchema.parse(input.botToken);
  const chatId = chatIdSchema.parse(input.chatId);
  const text = textSchema.parse(input.text);
  const options = deliveryOptionsSchema.parse(optionsInput);
  const fetcher = optionsInput.fetcher ?? fetch;
  const wait = optionsInput.sleep ?? sleep;

  for (let attempt = 1; attempt <= options.maxAttempts; attempt += 1) {
    try {
      const response = await fetcher(
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
      const payload: unknown = await response.json().catch(() => null);
      const parsed = telegramResponseSchema.safeParse(payload);

      if (response.ok && parsed.success && parsed.data.ok) {
        return;
      }

      const isRetryable =
        response.status === 429 || response.status >= 500;

      if (!isRetryable || attempt === options.maxAttempts) {
        throw new Error("TELEGRAM_MESSAGE_REJECTED");
      }

      await wait(
        getRetryDelayMs(
          attempt,
          options.baseDelayMs,
          parsed.success
            ? parsed.data.parameters?.retry_after
            : undefined,
        ),
      );
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "TELEGRAM_MESSAGE_REJECTED"
      ) {
        throw error;
      }

      if (attempt === options.maxAttempts) {
        throw new Error("TELEGRAM_MESSAGE_REJECTED", { cause: error });
      }

      await wait(getRetryDelayMs(attempt, options.baseDelayMs));
    }
  }
}
