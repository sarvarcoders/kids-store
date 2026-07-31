"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { useCart } from "@/components/cart/cart-provider";

const navigationItems = [
  {
    href: "/",
    label: "Bosh sahifa",
    icon: "🏠",
  },
  {
    href: "/catalog",
    label: "Katalog",
    icon: "👕",
  },
  {
    href: "/cart",
    label: "Savatcha",
    icon: "🛍",
  },
  {
    href: "/orders",
    label: "Buyurtmalarim",
    icon: "🧾",
  },
] as const;

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
              <span aria-hidden="true" className="relative text-lg">
                {item.icon}
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
