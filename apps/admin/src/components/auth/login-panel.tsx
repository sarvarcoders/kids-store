"use client";

import { useCallback, useEffect, useState } from "react";

type LoginStatus = "checking" | "error" | "browser";

function getTelegramInitData(): string {
  return window.Telegram?.WebApp?.initData ?? "";
}

export function LoginPanel(): React.ReactNode {
  const [status, setStatus] = useState<LoginStatus>("checking");
  const [message, setMessage] = useState(
    "Telegram ma’lumoti tekshirilmoqda…",
  );
  const [attempt, setAttempt] = useState(0);

  const login = useCallback(async (): Promise<void> => {
    setStatus("checking");
    setMessage("Telegram ma’lumoti tekshirilmoqda…");
    const startedAt = Date.now();
    let initData = getTelegramInitData();

    while (!initData && Date.now() - startedAt < 2_500) {
      await new Promise((resolve) => window.setTimeout(resolve, 50));
      initData = getTelegramInitData();
    }

    if (!window.Telegram?.WebApp) {
      setStatus("browser");
      setMessage(
        "Admin panelni Telegram botdagi admin tugmasi orqali oching.",
      );
      return;
    }

    if (!initData) {
      setStatus("error");
      setMessage(
        "Telegram autentifikatsiya ma’lumoti olinmadi. Botdagi admin tugmasidan qayta oching.",
      );
      return;
    }

    try {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ initData }),
        cache: "no-store",
        credentials: "same-origin",
      });
      const payload: unknown = await response.json();

      if (!response.ok) {
        const apiMessage =
          typeof payload === "object" &&
          payload !== null &&
          "error" in payload &&
          typeof payload.error === "object" &&
          payload.error !== null &&
          "message" in payload.error &&
          typeof payload.error.message === "string"
            ? payload.error.message
            : "Admin autentifikatsiyasi bajarilmadi.";
        throw new Error(apiMessage);
      }

      window.location.assign("/dashboard");
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Admin autentifikatsiyasi bajarilmadi.",
      );
    }
  }, []);

  useEffect(() => {
    void login();
  }, [attempt, login]);

  return (
    <section className="login-card" aria-live="polite">
      <div className="brand-mark" aria-hidden="true">
        KS
      </div>
      <h1>Kids Store Admin</h1>
      <p>{message}</p>
      {status !== "checking" ? (
        <button
          className="primary-button"
          onClick={() => { setAttempt((value) => value + 1); }}
          type="button"
        >
          Qayta urinish
        </button>
      ) : (
        <span className="loader" aria-label="Yuklanmoqda" />
      )}
      <small>
        Oddiy brauzerda parol orqali kirish hozircha mavjud emas.
        Xavfsiz kirish faqat Telegram initData orqali bajariladi.
      </small>
    </section>
  );
}
