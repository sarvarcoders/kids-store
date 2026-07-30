import type { Metadata } from "next";
import type { ReactNode } from "react";

import { ProductDetail } from "@/components/product/product-detail";

export const metadata: Metadata = {
  title: "Mahsulot",
};

interface ProductPageProperties {
  params: Promise<{
    id: string;
  }>;
}

export default async function ProductPage({
  params,
}: ProductPageProperties): Promise<ReactNode> {
  const { id } = await params;

  return <ProductDetail productId={id} />;
}
