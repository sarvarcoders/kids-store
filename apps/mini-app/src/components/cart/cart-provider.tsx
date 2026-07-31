"use client";

import {
  cartResponseSchema,
  type CartDto,
} from "@kids-store/shared/cart";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";

import { useTelegram } from "@/components/telegram/telegram-provider";
import { fetchMiniAppApi } from "@/lib/api/client";

interface CartContextValue {
  cart: CartDto | null;
  cartQuantity: number;
  error: string;
  isLoading: boolean;
  refreshCart: () => Promise<void>;
  replaceCart: (cart: CartDto) => void;
  setCartQuantity: (quantity: number) => void;
}

const CartContext = createContext<CartContextValue | null>(null);

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Savatchani yuklab bo‘lmadi.";
}

export function CartProvider({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const { isReady, readInitData } = useTelegram();
  const pathname = usePathname();
  const [cart, setCart] = useState<CartDto | null>(null);
  const [cartQuantity, setCartQuantityState] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const refreshCart = useCallback(async (): Promise<void> => {
    if (!isReady) {
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await fetchMiniAppApi(
        "/api/cart",
        readInitData,
        cartResponseSchema,
      );
      setCart(response.data);
      setCartQuantityState(response.data.totalQuantity);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }, [isReady, readInitData]);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    if (pathname === "/" || pathname === "/catalog") {
      return;
    }

    if (pathname === "/cart") {
      void refreshCart();
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void refreshCart();
    }, 1_500);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isReady, pathname, refreshCart]);

  const setCartQuantity = useCallback((quantity: number): void => {
    setCartQuantityState(Math.max(0, Math.trunc(quantity)));
    setIsLoading(false);
  }, []);

  const replaceCart = useCallback((nextCart: CartDto): void => {
    const parsedCart = cartResponseSchema.parse({ data: nextCart }).data;

    setCart(parsedCart);
    setCartQuantityState(parsedCart.totalQuantity);
    setError("");
    setIsLoading(false);
  }, []);
  const value = useMemo(
    () => ({
      cart,
      cartQuantity,
      error,
      isLoading,
      refreshCart,
      replaceCart,
      setCartQuantity,
    }),
    [
      cart,
      cartQuantity,
      error,
      isLoading,
      refreshCart,
      replaceCart,
      setCartQuantity,
    ],
  );

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error("useCart CartProvider ichida ishlatilishi kerak");
  }

  return context;
}
