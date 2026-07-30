"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  applyTelegramTheme,
  initializeTelegramWebApp,
  subscribeToTelegramTheme,
} from "@/lib/telegram/web-app";

interface TelegramContextValue {
  initData: string;
  isReady: boolean;
}

const TelegramContext = createContext<TelegramContextValue | null>(null);

export function TelegramProvider({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const [initData, setInitData] = useState("");
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const webApp = initializeTelegramWebApp();
    const updateTheme = (): void => {
      applyTelegramTheme(webApp);
    };

    updateTheme();
    setInitData(webApp?.initData ?? "");
    setIsReady(true);

    return subscribeToTelegramTheme(webApp, updateTheme);
  }, []);

  const value = useMemo(
    () => ({
      initData,
      isReady,
    }),
    [initData, isReady],
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
