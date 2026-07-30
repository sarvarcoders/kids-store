export {};

declare global {
  interface TelegramBackButton {
    hide(): void;
    offClick(callback: () => void): void;
    onClick(callback: () => void): void;
    show(): void;
  }

  interface TelegramWebApp {
    BackButton: TelegramBackButton;
    colorScheme: "light" | "dark";
    expand(): void;
    initData: string;
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
