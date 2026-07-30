export {};

declare global {
  interface TelegramBackButton {
    hide(): void;
    offClick(callback: () => void): void;
    onClick(callback: () => void): void;
    show(): void;
  }

  interface TelegramHapticFeedback {
    notificationOccurred(type: "error" | "success" | "warning"): void;
    selectionChanged(): void;
  }

  interface TelegramMainButton {
    disable(): void;
    enable(): void;
    hide(): void;
    hideProgress(): void;
    offClick(callback: () => void): void;
    onClick(callback: () => void): void;
    setText(text: string): void;
    show(): void;
    showProgress(leaveActive?: boolean): void;
  }

  interface TelegramWebApp {
    BackButton: TelegramBackButton;
    HapticFeedback?: TelegramHapticFeedback;
    MainButton?: TelegramMainButton;
    colorScheme: "light" | "dark";
    expand(): void;
    initData: string;
    platform?: string;
    offEvent(event: "themeChanged", callback: () => void): void;
    onEvent(event: "themeChanged", callback: () => void): void;
    ready(): void;
  }

  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}
