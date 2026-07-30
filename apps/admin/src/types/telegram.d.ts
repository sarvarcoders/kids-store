interface TelegramAdminWebApp {
  initData: string;
  ready(): void;
  expand(): void;
}

interface Window {
  Telegram?: {
    WebApp?: TelegramAdminWebApp;
  };
}
