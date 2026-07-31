"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

interface AdminDto {
  telegramId: string;
  firstName: string;
  username?: string;
}

interface SessionPayload {
  data: {
    admin: AdminDto;
    csrfToken: string;
  };
}

interface AdminAuthContextValue {
  admin: AdminDto;
  request: <T>(
    path: string,
    options?: {
      body?: unknown;
      method?: "GET" | "POST" | "PATCH" | "DELETE";
      idempotent?: boolean;
    },
  ) => Promise<T>;
  upload: <T>(
    path: string,
    body: FormData,
    onProgress?: (percent: number) => void,
  ) => Promise<T>;
  logout: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(
  null,
);

function createIdempotencyKey(): string {
  return crypto.randomUUID().replaceAll("-", "");
}

function isUnknownRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getApiErrorMessage(payload: unknown): string {
  if (isUnknownRecord(payload) && isUnknownRecord(payload.error)) {
    const error = payload.error;

    if (
      Array.isArray(error.fields) &&
      error.fields.length > 0
    ) {
      const firstField: unknown = error.fields[0];

      if (
        isUnknownRecord(firstField) &&
        typeof firstField.message === "string"
      ) {
        return firstField.message;
      }
    }

    if (typeof error.message === "string") {
      return error.message;
    }
  }

  return "Amalni bajarib bo‘lmadi.";
}

function parseResponsePayload(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

export function AdminAuthProvider({
  initialAdmin,
  children,
}: {
  initialAdmin: AdminDto;
  children: ReactNode;
}): ReactNode {
  const [admin, setAdmin] = useState(initialAdmin);
  const [csrfToken, setCsrfToken] = useState("");

  useEffect(() => {
    void fetch("/api/auth/session", {
      cache: "no-store",
      credentials: "same-origin",
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("SESSION_UNAVAILABLE");
        }

        return (await response.json()) as SessionPayload;
      })
      .then((payload) => {
        setAdmin(payload.data.admin);
        setCsrfToken(payload.data.csrfToken);
      })
      .catch(() => {
        window.location.assign("/login");
      });
  }, []);

  const request = useCallback(
    async <T,>(
      path: string,
      options: {
        body?: unknown;
        method?: "GET" | "POST" | "PATCH" | "DELETE";
        idempotent?: boolean;
      } = {},
    ): Promise<T> => {
      const method = options.method ?? "GET";
      const headers = new Headers({
        Accept: "application/json",
      });

      if (method !== "GET") {
        if (!csrfToken) {
          throw new Error("Admin sessiyasi hali tayyor emas.");
        }

        headers.set("x-admin-csrf-token", csrfToken);
      }

      if (options.idempotent) {
        headers.set("x-idempotency-key", createIdempotencyKey());
      }

      if (options.body !== undefined) {
        headers.set("Content-Type", "application/json");
      }

      const response = await fetch(path, {
        method,
        headers,
        cache: "no-store",
        credentials: "same-origin",
        ...(options.body === undefined
          ? {}
          : { body: JSON.stringify(options.body) }),
      });
      const payload: unknown = await response.json();

      if (!response.ok) {
        throw new Error(getApiErrorMessage(payload));
      }

      return payload as T;
    },
    [csrfToken],
  );

  const upload = useCallback(
    async <T,>(
      path: string,
      body: FormData,
      onProgress?: (percent: number) => void,
    ): Promise<T> => {
      if (!csrfToken) {
        throw new Error("Admin sessiyasi hali tayyor emas.");
      }

      return new Promise<T>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", path);
        xhr.timeout = 120_000;
        xhr.withCredentials = true;
        xhr.setRequestHeader("Accept", "application/json");
        xhr.setRequestHeader("x-admin-csrf-token", csrfToken);
        xhr.upload.addEventListener("progress", (event) => {
          if (event.lengthComputable) {
            onProgress?.(
              Math.min(100, Math.round((event.loaded / event.total) * 100)),
            );
          }
        });
        xhr.addEventListener("load", () => {
          const payload = parseResponsePayload(xhr.responseText);

          if (xhr.status < 200 || xhr.status >= 300) {
            reject(new Error(getApiErrorMessage(payload)));
            return;
          }

          resolve(payload as T);
        });
        xhr.addEventListener("error", () => {
          reject(new Error("Rasmni yuborishda tarmoq xatosi yuz berdi."));
        });
        xhr.addEventListener("timeout", () => {
          reject(new Error("Rasm yuklash vaqti tugadi. Qayta urinib ko‘ring."));
        });
        xhr.send(body);
      });
    },
    [csrfToken],
  );

  const logout = useCallback(async (): Promise<void> => {
    await request("/api/auth/logout", {
      method: "POST",
    });
    window.location.assign("/login");
  }, [request]);

  const value = useMemo(
    () => ({ admin, request, upload, logout }),
    [admin, logout, request, upload],
  );

  return (
    <AdminAuthContext.Provider value={value}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth(): AdminAuthContextValue {
  const context = useContext(AdminAuthContext);

  if (!context) {
    throw new Error(
      "useAdminAuth AdminAuthProvider ichida ishlatilishi kerak",
    );
  }

  return context;
}
