import type { Metadata } from "next";
import type { ReactNode } from "react";

import { OrderDetail } from "@/components/orders/order-detail";

export const metadata: Metadata = {
  title: "Buyurtma",
};

interface OrderPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function OrderRoute({
  params,
}: OrderPageProps): Promise<ReactNode> {
  const { id } = await params;

  return <OrderDetail orderId={id} />;
}
