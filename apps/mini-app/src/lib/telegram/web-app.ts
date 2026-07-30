export const TELEGRAM_SDK_WAIT_TIMEOUT_MS = 2_500;
export const TELEGRAM_SDK_POLL_INTERVAL_MS = 50;

export type TelegramInitializationStatus =
  | "ready"
  | "missing-init-data"
  | "browser";

export interface TelegramInitializationDiagnostics {
  hasTelegramObject: boolean;
  hasInitData: boolean;
  hasUserField: boolean;
}

export interface TelegramInitializationResult {
  diagnostics: TelegramInitializationDiagnostics;
  initData: string;
  status: TelegramInitializationStatus;
  webApp: TelegramWebApp | null;
}

interface TelegramInitializationOptions {
  getWebApp?: () => TelegramWebApp | null;
  intervalMs?: number;
  signal?: AbortSignal;
  timeoutMs?: number;
  wait?: (durationMs: number, signal?: AbortSignal) => Promise<void>;
}

export function getTelegramWebApp(): TelegramWebApp | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.Telegram?.WebApp ?? null;
}

function waitForDelay(
  durationMs: number,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }

    const timeoutId = window.setTimeout(() => {
      signal?.removeEventListener("abort", handleAbort);
      resolve();
    }, durationMs);
    const handleAbort = (): void => {
      window.clearTimeout(timeoutId);
      signal?.removeEventListener("abort", handleAbort);
      resolve();
    };

    signal?.addEventListener("abort", handleAbort, { once: true });
  });
}

function prepareTelegramWebApp(webApp: TelegramWebApp): void {
  try {
    webApp.ready();
  } catch {
    // Eski Telegram klientida ready xatosi initializationni to‘xtatmasin.
  }

  try {
    webApp.expand();
  } catch {
    // Expand qo‘llanmasa Mini App mavjud viewport bilan ishlashda davom etadi.
  }
}

function isTelegramWebView(webApp: TelegramWebApp | null): boolean {
  const platform = webApp?.platform?.trim().toLowerCase() ?? "";

  return platform.length > 0 && platform !== "unknown";
}

function createDiagnostics(
  webApp: TelegramWebApp | null,
  initData: string,
): TelegramInitializationDiagnostics {
  let hasUserField: boolean;

  try {
    hasUserField =
      initData.length > 0 &&
      new URLSearchParams(initData).has("user");
  } catch {
    hasUserField = false;
  }

  return {
    hasTelegramObject: webApp !== null,
    hasInitData: initData.length > 0,
    hasUserField,
  };
}

function createInitializationResult(
  webApp: TelegramWebApp | null,
  initData: string,
  status: TelegramInitializationStatus,
): TelegramInitializationResult {
  return {
    diagnostics: createDiagnostics(webApp, initData),
    initData,
    status,
    webApp,
  };
}

export function logTelegramDevelopmentDiagnostics(
  diagnostics: TelegramInitializationDiagnostics,
): void {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  console.info("Telegram Mini App SDK diagnostikasi", diagnostics);
}

export async function initializeTelegramWebApp(
  options: TelegramInitializationOptions = {},
): Promise<TelegramInitializationResult> {
  const getWebApp = options.getWebApp ?? getTelegramWebApp;
  const intervalMs = Math.max(
    1,
    options.intervalMs ?? TELEGRAM_SDK_POLL_INTERVAL_MS,
  );
  const timeoutMs = Math.max(
    0,
    options.timeoutMs ?? TELEGRAM_SDK_WAIT_TIMEOUT_MS,
  );
  const wait = options.wait ?? waitForDelay;
  const maximumChecks =
    Math.max(1, Math.ceil(timeoutMs / intervalMs)) + 1;
  let webApp: TelegramWebApp | null = null;
  let preparedWebApp: TelegramWebApp | null = null;

  for (let check = 0; check < maximumChecks; check += 1) {
    if (options.signal?.aborted) {
      break;
    }

    webApp = getWebApp();

    if (webApp && webApp !== preparedWebApp) {
      prepareTelegramWebApp(webApp);
      preparedWebApp = webApp;
    }

    const initData =
      typeof webApp?.initData === "string" ? webApp.initData : "";

    if (initData.length > 0) {
      return createInitializationResult(webApp, initData, "ready");
    }

    if (check < maximumChecks - 1) {
      await wait(intervalMs, options.signal);
    }
  }

  const initData =
    typeof webApp?.initData === "string" ? webApp.initData : "";
  const status = isTelegramWebView(webApp)
    ? "missing-init-data"
    : "browser";

  return createInitializationResult(webApp, initData, status);
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

export function notifyTelegramHaptic(
  type: "error" | "success" | "warning",
): void {
  try {
    getTelegramWebApp()?.HapticFeedback?.notificationOccurred(type);
  } catch {
    // Eski Telegram klientida haptic mavjud bo‘lmasa UI davom etadi.
  }
}

export function hasTelegramMainButton(): boolean {
  return getTelegramWebApp()?.MainButton !== undefined;
}

export function showTelegramMainButton(options: {
  enabled: boolean;
  loading: boolean;
  onClick: () => void;
  text: string;
  visible: boolean;
}): () => void {
  const mainButton = getTelegramWebApp()?.MainButton;

  if (!mainButton) {
    return () => undefined;
  }

  try {
    mainButton.setText(options.text);
    mainButton.offClick(options.onClick);
    mainButton.onClick(options.onClick);

    if (options.enabled) {
      mainButton.enable();
    } else {
      mainButton.disable();
    }

    if (options.loading) {
      mainButton.showProgress(true);
    } else {
      mainButton.hideProgress();
    }

    if (options.visible) {
      mainButton.show();
    } else {
      mainButton.hide();
    }
  } catch {
    return () => undefined;
  }

  return () => {
    try {
      mainButton.offClick(options.onClick);
      mainButton.hideProgress();
      mainButton.hide();
    } catch {
      // Telegram MainButton cleanup qo‘llanmasa xavfsiz tugatamiz.
    }
  };
}
