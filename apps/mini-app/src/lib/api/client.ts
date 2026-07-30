import {
  apiErrorResponseSchema,
  type ApiErrorResponse,
} from "@kids-store/shared";
import type { ZodType } from "zod";

const TELEGRAM_INIT_DATA_HEADER = "x-telegram-init-data";

export class ApiClientError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
  }
}

export async function fetchMiniAppApi<T>(
  path: string,
  initData: string,
  schema: ZodType<T>,
  signal?: AbortSignal,
): Promise<T> {
  const headers = new Headers({
    Accept: "application/json",
  });

  if (initData.length > 0) {
    headers.set(TELEGRAM_INIT_DATA_HEADER, initData);
  }

  const response = await fetch(path, {
    method: "GET",
    headers,
    cache: "no-store",
    ...(signal === undefined ? {} : { signal }),
  });
  const payload: unknown = await response.json();

  if (!response.ok) {
    const parsedError = apiErrorResponseSchema.safeParse(payload);
    const error: ApiErrorResponse = parsedError.success
      ? parsedError.data
      : {
          error: {
            code: "UNEXPECTED_RESPONSE",
            message:
              "Ma’lumotni yuklab bo‘lmadi. Keyinroq qayta urinib ko‘ring.",
          },
        };

    throw new ApiClientError(error.error.message, response.status);
  }

  return schema.parse(payload);
}
