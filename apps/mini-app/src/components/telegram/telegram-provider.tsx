"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  applyTelegramTheme,
  initializeTelegramWebApp,
  logTelegramDevelopmentDiagnostics,
  subscribeToTelegramTheme,
  type TelegramInitializationStatus,
} from "@/lib/telegram/web-app";

type TelegramProviderStatus =
  | "initializing"
  | TelegramInitializationStatus
  | "development-mock";

interface TelegramContextValue {
  initializationError: string | null;
  isReady: boolean;
  readInitData: () => string;
  retryInitialization: () => void;
  status: TelegramProviderStatus;
}

const TelegramContext = createContext<TelegramContextValue | null>(null);

const INITIALIZATION_ERROR_MESSAGES: Readonly<
  Record<Exclude<TelegramInitializationStatus, "ready">, string>
> = {
  browser:
    "Bu sahifa oddiy brauzerda ochilgan. Mini Appni botdagi Do‘kon tugmasi orqali oching.",
  "missing-init-data":
    "Telegram ma’lumoti olinmadi. Mini Appni botdagi Do‘kon tugmasi orqali oching.",
};

export function TelegramProvider({
  allowDevelopmentMock = false,
  children,
}: {
  allowDevelopmentMock?: boolean;
  children: ReactNode;
}): ReactNode {
  const initDataRef = useRef("");
  const [status, setStatus] =
    useState<TelegramProviderStatus>("initializing");
  const [initializationVersion, setInitializationVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let unsubscribeFromTheme = (): void => undefined;

    initDataRef.current = "";
    setStatus("initializing");

    void initializeTelegramWebApp({
      signal: controller.signal,
    })
      .then((result) => {
        if (controller.signal.aborted) {
          return;
        }

        const updateTheme = (): void => {
          applyTelegramTheme(result.webApp);
        };

        updateTheme();
        unsubscribeFromTheme = subscribeToTelegramTheme(
          result.webApp,
          updateTheme,
        );
        logTelegramDevelopmentDiagnostics(result.diagnostics);
        initDataRef.current = result.initData;
        setStatus(
          allowDevelopmentMock && result.status !== "ready"
            ? "development-mock"
            : result.status,
        );
      })
      .catch(() => {
        if (controller.signal.aborted) {
          return;
        }

        logTelegramDevelopmentDiagnostics({
          hasTelegramObject: false,
          hasInitData: false,
          hasUserField: false,
        });
        initDataRef.current = "";
        setStatus(
          allowDevelopmentMock ? "development-mock" : "browser",
        );
      });

    return () => {
      controller.abort();
      unsubscribeFromTheme();
    };
  }, [allowDevelopmentMock, initializationVersion]);

  const readInitData = useCallback(() => initDataRef.current, []);
  const retryInitialization = useCallback(() => {
    initDataRef.current = "";
    setStatus("initializing");
    setInitializationVersion((version) => version + 1);
  }, []);
  const isReady =
    status === "ready" || status === "development-mock";
  const initializationError =
    status === "browser" || status === "missing-init-data"
      ? INITIALIZATION_ERROR_MESSAGES[status]
      : null;

  const value = useMemo(
    () => ({
      initializationError,
      isReady,
      readInitData,
      retryInitialization,
      status,
    }),
    [
      initializationError,
      isReady,
      readInitData,
      retryInitialization,
      status,
    ],
  );

  return (
    <TelegramContext.Provider value={value}>
      {children}
    </TelegramContext.Provider>
  );
}

export function useTelegram(): TelegramContextValue {
  const context = useContext(TelegramContext);

  if (!context) {
    throw new Error("useTelegram TelegramProvider ichida ishlatilishi kerak");
  }

  return context;
}
