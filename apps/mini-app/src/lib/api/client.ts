import type { ZodType } from "zod";

export const TELEGRAM_INIT_DATA_HEADER = "x-telegram-init-data";

export type TelegramInitDataSource = string | (() => string);

export interface MiniAppApiRequestOptions {
  body?: unknown;
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  signal?: AbortSignal;
}

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
  initDataSource: TelegramInitDataSource,
  schema: ZodType<T>,
  signal?: AbortSignal,
): Promise<T> {
  return requestMiniAppApi(
    path,
    initDataSource,
    schema,
    signal === undefined ? {} : { signal },
  );
}

export async function requestMiniAppApi<T>(
  path: string,
  initDataSource: TelegramInitDataSource,
  schema: ZodType<T>,
  options: MiniAppApiRequestOptions = {},
): Promise<T> {
  const payload = await requestMiniAppApiJson<unknown>(
    path,
    initDataSource,
    options,
  );

  return schema.parse(payload);
}

export async function requestMiniAppApiJson<T>(
  path: string,
  initDataSource: TelegramInitDataSource,
  options: MiniAppApiRequestOptions = {},
): Promise<T> {
  const initData =
    typeof initDataSource === "function"
      ? initDataSource()
      : initDataSource;
  const headers = new Headers({ Accept: "application/json" });

  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  if (initData.length > 0) {
    headers.set(TELEGRAM_INIT_DATA_HEADER, initData);
  }

  const response = await fetch(path, {
    method: options.method ?? "GET",
    headers,
    cache: "no-store",
    ...(options.body === undefined
      ? {}
      : { body: JSON.stringify(options.body) }),
    ...(options.signal === undefined
      ? {}
      : { signal: options.signal }),
  });
  const payload: unknown = await response.json();

  if (!response.ok) {
    throw new ApiClientError(getSafeApiErrorMessage(payload), response.status);
  }

  return payload as T;
}

function getSafeApiErrorMessage(payload: unknown): string {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof payload.error === "object" &&
    payload.error !== null &&
    "message" in payload.error &&
    typeof payload.error.message === "string" &&
    payload.error.message.trim().length > 0 &&
    payload.error.message.length <= 300
  ) {
    return payload.error.message;
  }

  return "Ma’lumotni yuklab bo‘lmadi. Keyinroq qayta urinib ko‘ring.";
}
