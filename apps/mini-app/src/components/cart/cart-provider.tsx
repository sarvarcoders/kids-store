"use client";

import {
  cartResponseSchema,
  type CartDto,
} from "@kids-store/shared";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { useTelegram } from "@/components/telegram/telegram-provider";
import { fetchMiniAppApi } from "@/lib/api/client";

interface CartContextValue {
  cart: CartDto | null;
  error: string;
  isLoading: boolean;
  refreshCart: () => Promise<void>;
  replaceCart: (cart: CartDto) => void;
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
  const [cart, setCart] = useState<CartDto | null>(null);
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
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }, [isReady, readInitData]);

  useEffect(() => {
    void refreshCart();
  }, [refreshCart]);

  const replaceCart = useCallback((nextCart: CartDto): void => {
    setCart(cartResponseSchema.parse({ data: nextCart }).data);
    setError("");
  }, []);
  const value = useMemo(
    () => ({
      cart,
      error,
      isLoading,
      refreshCart,
      replaceCart,
    }),
    [cart, error, isLoading, refreshCart, replaceCart],
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
