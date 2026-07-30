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
  logout: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(
  null,
);

function createIdempotencyKey(): string {
  return crypto.randomUUID().replaceAll("-", "");
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
        const message =
          typeof payload === "object" &&
          payload !== null &&
          "error" in payload &&
          typeof payload.error === "object" &&
          payload.error !== null &&
          "message" in payload.error &&
          typeof payload.error.message === "string"
            ? payload.error.message
            : "Amalni bajarib bo‘lmadi.";

        throw new Error(message);
      }

      return payload as T;
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
    () => ({ admin, request, logout }),
    [admin, logout, request],
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
