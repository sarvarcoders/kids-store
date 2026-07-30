export function getTelegramWebApp(): TelegramWebApp | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.Telegram?.WebApp ?? null;
}

export function initializeTelegramWebApp(): TelegramWebApp | null {
  const webApp = getTelegramWebApp();

  if (!webApp) {
    return null;
  }

  try {
    webApp.ready();
    webApp.expand();
  } catch {
    return webApp;
  }

  return webApp;
}

export function applyTelegramTheme(
  webApp: TelegramWebApp | null,
): void {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.dataset.tgColorScheme =
    webApp?.colorScheme ?? "light";
}

export function subscribeToTelegramTheme(
  webApp: TelegramWebApp | null,
  callback: () => void,
): () => void {
  if (!webApp) {
    return () => undefined;
  }

  webApp.onEvent("themeChanged", callback);

  return () => {
    try {
      webApp.offEvent("themeChanged", callback);
    } catch {
      // Telegram versiyasi event cleanup’ni qo‘llamasa xavfsiz tugatamiz.
    }
  };
}

export function showTelegramBackButton(
  callback: () => void,
): () => void {
  const webApp = getTelegramWebApp();

  if (!webApp) {
    return () => undefined;
  }

  try {
    webApp.BackButton.onClick(callback);
    webApp.BackButton.show();
  } catch {
    return () => undefined;
  }

  return () => {
    try {
      webApp.BackButton.offClick(callback);
      webApp.BackButton.hide();
    } catch {
      // Telegram obyektisiz yoki eski versiyada cleanup majburiy emas.
    }
  };
}
