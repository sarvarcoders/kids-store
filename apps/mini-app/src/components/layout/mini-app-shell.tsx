"use client";

import type { ReactNode } from "react";

import { CartProvider } from "@/components/cart/cart-provider";
import {
  BottomNavigation,
} from "@/components/navigation/bottom-navigation";

export function MiniAppShell({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  return (
    <CartProvider>
      <div className="mini-app-content">{children}</div>
      <BottomNavigation />
    </CartProvider>
  );
}
