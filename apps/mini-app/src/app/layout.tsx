import type { Metadata, Viewport } from "next";
import Script from "next/script";
import type { ReactNode } from "react";

import { TelegramProvider } from "@/components/telegram/telegram-provider";
import { MiniAppShell } from "@/components/layout/mini-app-shell";
import { isMiniAppDevelopmentMockEnabled } from "@/lib/env/server";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Kids Store",
    template: "%s · Kids Store",
  },
  description:
    "Bolalar kiyimlari uchun Telegram-first mobil katalog.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "light dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>): ReactNode {
  return (
    <html lang="uz" suppressHydrationWarning>
      <head>
        <link href="https://telegram.org" rel="dns-prefetch" />
        <link href="https://telegram.org" rel="preconnect" />
        <Script
          id="telegram-web-app-sdk"
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
        />
      </head>
      <body>
        <TelegramProvider
          allowDevelopmentMock={isMiniAppDevelopmentMockEnabled()}
        >
          <MiniAppShell>{children}</MiniAppShell>
        </TelegramProvider>
      </body>
    </html>
  );
}
