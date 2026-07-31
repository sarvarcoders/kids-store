import {
  Queue,
  Worker,
  type ConnectionOptions,
  type Job,
  type JobsOptions,
} from "bullmq";
import { z } from "zod";

export const notificationJobSchema = z.object({
  chatId: z.string().trim().min(1).max(100),
  eventId: z.string().trim().min(1).max(120).regex(/^[a-z0-9_-]+$/i),
  kind: z.enum(["checkout_customer", "checkout_admin"]),
  text: z.string().min(1).max(4_096),
});

export type NotificationJobData = z.infer<typeof notificationJobSchema>;

const deadLetterJobSchema = z.object({
  failedAt: z.iso.datetime(),
  original: notificationJobSchema,
  reasonCode: z.enum(["delivery_failed", "invalid_payload"]),
});

export type DeadLetterJobData = z.infer<typeof deadLetterJobSchema>;

const queueConfigSchema = z.object({
  keyPrefix: z.string().trim().min(1).max(40),
});

const NOTIFICATION_QUEUE_NAME = "telegram-notifications";
const DEAD_LETTER_QUEUE_NAME = "telegram-notifications-dead-letter";
const NOTIFICATION_JOB_OPTIONS = {
  attempts: 4,
  backoff: {
    type: "exponential",
    delay: 1_000,
    jitter: 0.25,
  },
  removeOnComplete: {
    age: 60 * 60,
    count: 1_000,
  },
  removeOnFail: {
    age: 7 * 24 * 60 * 60,
    count: 5_000,
  },
} satisfies JobsOptions;

export interface NotificationQueueConfig {
  connection: ConnectionOptions;
  keyPrefix: string;
  onError?: (error: unknown) => void;
}

export interface NotificationQueueHandle {
  close(): Promise<void>;
  enqueue(input: NotificationJobData): Promise<void>;
}

export interface NotificationWorkerConfig extends NotificationQueueConfig {
  concurrency?: number;
  onError?: (error: unknown) => void;
  send(input: NotificationJobData): Promise<void>;
}

export interface NotificationWorkerHandle {
  close(): Promise<void>;
}

export function createNotificationQueue(
  input: NotificationQueueConfig,
): NotificationQueueHandle {
  const config = queueConfigSchema.parse(input);
  const queue = new Queue<NotificationJobData>(NOTIFICATION_QUEUE_NAME, {
    connection: input.connection,
    prefix: config.keyPrefix,
  });

  queue.on("error", (error) => {
    input.onError?.(error);
  });

  return {
    async close(): Promise<void> {
      await queue.close();
    },
    async enqueue(jobInput: NotificationJobData): Promise<void> {
      const job = notificationJobSchema.parse(jobInput);

      await queue.add(job.kind, job, {
        ...NOTIFICATION_JOB_OPTIONS,
        jobId: job.eventId,
      });
    },
  };
}

export function createNotificationWorker(
  input: NotificationWorkerConfig,
): NotificationWorkerHandle {
  const config = queueConfigSchema.parse(input);
  const concurrency = z.number().int().min(1).max(50).parse(input.concurrency ?? 5);
  const deadLetterQueue = new Queue<DeadLetterJobData>(DEAD_LETTER_QUEUE_NAME, {
    connection: input.connection,
    prefix: config.keyPrefix,
  });
  const worker = new Worker<NotificationJobData>(
    NOTIFICATION_QUEUE_NAME,
    async (job) => {
      const notification = notificationJobSchema.safeParse(job.data);

      if (!notification.success) {
        throw new Error("INVALID_NOTIFICATION_PAYLOAD");
      }

      await input.send(notification.data);
    },
    {
      connection: input.connection,
      concurrency,
      prefix: config.keyPrefix,
    },
  );

  worker.on("error", (error) => {
    input.onError?.(error);
  });
  worker.on("failed", (job, error) => {
    if (job && isFinalAttempt(job)) {
      void moveToDeadLetter(deadLetterQueue, job, error).catch((queueError: unknown) => {
        input.onError?.(queueError);
      });
    }
  });

  return {
    async close(): Promise<void> {
      await Promise.all([worker.close(), deadLetterQueue.close()]);
    },
  };
}

function isFinalAttempt(job: Job<NotificationJobData>): boolean {
  return job.attemptsMade >= (job.opts.attempts ?? 1);
}

async function moveToDeadLetter(
  queue: Queue<DeadLetterJobData>,
  job: Job<NotificationJobData>,
  error: Error,
): Promise<void> {
  const parsed = notificationJobSchema.safeParse(job.data);

  if (!parsed.success) {
    return;
  }

  const deadLetter = deadLetterJobSchema.parse({
    failedAt: new Date().toISOString(),
    original: parsed.data,
    reasonCode:
      error.message === "INVALID_NOTIFICATION_PAYLOAD"
        ? "invalid_payload"
        : "delivery_failed",
  });

  await queue.add("dead-letter", deadLetter, {
    jobId: `${parsed.data.eventId}-dead`,
    removeOnComplete: false,
    removeOnFail: false,
  });
}
