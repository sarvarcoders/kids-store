"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { useAdminAuth } from "@/components/auth/admin-auth-provider";

const navigation = [
  { href: "/dashboard", label: "Dashboard", icon: "▦" },
  { href: "/products", label: "Mahsulotlar", icon: "◫" },
  { href: "/categories", label: "Kategoriyalar", icon: "◇" },
  { href: "/orders", label: "Buyurtmalar", icon: "◎" },
  { href: "/customers", label: "Mijozlar", icon: "♙" },
  { href: "/channel-posts", label: "Kanal postlari", icon: "↗" },
  { href: "/audit-logs", label: "Audit log", icon: "≡" },
  { href: "/settings", label: "Sozlamalar", icon: "⚙" },
] as const;

export function AdminShell({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const pathname = usePathname();
  const { admin, logout } = useAdminAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const title = useMemo(
    () =>
      navigation.find(
        (item) =>
          pathname === item.href ||
          pathname.startsWith(`${item.href}/`),
      )?.label ?? "Admin",
    [pathname],
  );

  useEffect(() => {
    const stored = window.localStorage.getItem("admin-theme");
    const shouldUseDark =
      stored === "dark" ||
      (stored === null &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    setDark(shouldUseDark);
    document.documentElement.dataset.theme = shouldUseDark
      ? "dark"
      : "light";
  }, []);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  const toggleTheme = (): void => {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? "dark" : "light";
    window.localStorage.setItem(
      "admin-theme",
      next ? "dark" : "light",
    );
  };

  const navigationContent = (
    <>
      <Link className="sidebar-brand" href="/dashboard">
        <span>KS</span>
        <strong>Kids Store</strong>
      </Link>
      <nav aria-label="Asosiy navigatsiya">
        {navigation.map((item) => (
          <Link
            aria-current={
              pathname === item.href ||
              pathname.startsWith(`${item.href}/`)
                ? "page"
                : undefined
            }
            className="nav-link"
            href={item.href}
            key={item.href}
          >
            <span aria-hidden="true">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>
    </>
  );

  return (
    <div className="admin-layout">
      <aside className="sidebar">{navigationContent}</aside>
      {drawerOpen ? (
        <div className="drawer-layer">
          <button
            aria-label="Menyuni yopish"
            className="drawer-backdrop"
            onClick={() => { setDrawerOpen(false); }}
            type="button"
          />
          <aside className="mobile-drawer">{navigationContent}</aside>
        </div>
      ) : null}
      <div className="admin-main">
        <header className="admin-header">
          <div className="header-title">
            <button
              aria-expanded={drawerOpen}
              aria-label="Menyuni ochish"
              className="icon-button menu-button"
              onClick={() => { setDrawerOpen(true); }}
              type="button"
            >
              ☰
            </button>
            <div>
              <span>Boshqaruv paneli</span>
              <h1>{title}</h1>
            </div>
          </div>
          <div className="header-actions">
            <button
              aria-label="Rang mavzusini almashtirish"
              className="icon-button"
              onClick={toggleTheme}
              type="button"
            >
              {dark ? "☀" : "☾"}
            </button>
            <div className="admin-identity">
              <strong>{admin.firstName}</strong>
              <span>
                {admin.username
                  ? `@${admin.username}`
                  : admin.telegramId}
              </span>
            </div>
            <button
              className="secondary-button"
              onClick={() => void logout()}
              type="button"
            >
              Chiqish
            </button>
          </div>
        </header>
        <main className="page-content">{children}</main>
      </div>
    </div>
  );
}
