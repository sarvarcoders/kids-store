import { notFound } from "next/navigation";

import { ProductEditor } from "@/components/products/product-editor";
import {
  getAdminProduct,
  listProductEditorCategories,
} from "@/lib/products/products.service";
import { formatAdminDate } from "@/lib/format/display";

export const dynamic = "force-dynamic";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.ReactNode> {
  const { id } = await params;
  const [product, categories] = await Promise.all([
    getAdminProduct(id),
    listProductEditorCategories(),
  ]);

  if (!product) {
    notFound();
  }

  return (
    <div className="page-stack">
      <div className="page-intro">
        <span>{product.code}</span>
        <h2>{product.name}</h2>
        <p>
          Buyurtmaga bog‘langan olib tashlangan variantlar o‘chirilmaydi;
          ularning stock qiymati 0 qilinadi.
        </p>
      </div>
      <ProductEditor
        categories={categories}
        initialProduct={{
          id: product.id,
          code: product.code,
          name: product.name,
          slug: product.slug,
          description: product.description,
          categoryId: product.categoryId,
          price: product.price,
          discountPrice: product.discountPrice,
          isActive: product.isActive,
          images: product.images,
          variants: product.variants,
        }}
      />
      <section className="panel">
        <div className="panel-heading">
          <div>
            <span>Telegram</span>
            <h2>Oldingi kanal postlari</h2>
          </div>
        </div>
        {product.channelPosts.length > 0 ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Message ID</th>
                  <th>Kanal ID</th>
                  <th>Sana</th>
                </tr>
              </thead>
              <tbody>
                {product.channelPosts.map((post) => (
                  <tr key={post.id}>
                    <td>{post.telegramMessageId}</td>
                    <td>{post.telegramChannelId.toString()}</td>
                    <td>{formatAdminDate(post.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="hint">Mahsulot hali kanalga chiqarilmagan.</p>
        )}
      </section>
    </div>
  );
}
