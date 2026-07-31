"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { useCart } from "@/components/cart/cart-provider";

const navigationItems = [
  {
    href: "/",
    label: "Bosh sahifa",
    icon: "home",
  },
  {
    href: "/catalog",
    label: "Katalog",
    icon: "catalog",
  },
  {
    href: "/cart",
    label: "Savatcha",
    icon: "cart",
  },
  {
    href: "/orders",
    label: "Buyurtmalarim",
    icon: "orders",
  },
] as const;

type NavigationIconName = (typeof navigationItems)[number]["icon"];

function NavigationIcon({ name }: { name: NavigationIconName }): ReactNode {
  const paths: Readonly<Record<NavigationIconName, ReactNode>> = {
    home: (
      <path d="M3.5 10.5 12 3l8.5 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-4.5v-6h-5v6H5a1.5 1.5 0 0 1-1.5-1.5z" />
    ),
    catalog: (
      <path d="M5 4.5h14A1.5 1.5 0 0 1 20.5 6v12a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 18V6A1.5 1.5 0 0 1 5 4.5Zm3.5 0v15M8.5 9h12" />
    ),
    cart: (
      <path d="M3 4h2l2.1 10.1a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.6L20 8H6m3.2 11.5h.1m7.4 0h.1" />
    ),
    orders: (
      <path d="M6 3.5h12v17l-3-2-3 2-3-2-3 2zM9 8h6m-6 4h6" />
    ),
  };

  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="22"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
      width="22"
    >
      {paths[name]}
    </svg>
  );
}

export function BottomNavigation(): ReactNode {
  const pathname = usePathname();
  const { cartQuantity } = useCart();

  return (
    <nav
      aria-label="Asosiy navigatsiya"
      className="bottom-navigation"
    >
      <div className="mx-auto grid w-full max-w-3xl grid-cols-4 gap-1 px-2">
        {navigationItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href ||
                pathname.startsWith(`${item.href}/`);

          return (
            <Link
              aria-current={isActive ? "page" : undefined}
              className="bottom-navigation-link focus-ring"
              data-active={isActive}
              href={item.href}
              key={item.href}
              prefetch={false}
            >
              <span className="navigation-icon relative">
                <NavigationIcon name={item.icon} />
                {item.href === "/cart" &&
                cartQuantity > 0 ? (
                  <span className="cart-badge">
                    {cartQuantity > 99
                      ? "99+"
                      : String(cartQuantity)}
                  </span>
                ) : null}
              </span>
              <span className="truncate text-[0.62rem] font-extrabold">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
