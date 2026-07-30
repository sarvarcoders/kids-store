import { ProductEditor } from "@/components/products/product-editor";
import { listProductEditorCategories } from "@/lib/products/products.service";

export const dynamic = "force-dynamic";

export default async function NewProductPage(): Promise<React.ReactNode> {
  const categories = await listProductEditorCategories();

  return (
    <div className="page-stack">
      <div className="page-intro">
        <span>Katalog</span>
        <h2>Yangi mahsulot</h2>
        <p>
          Narx va stock serverda qayta tekshiriladi. Rasm URL’i
          tashqi serverdan fetch qilinmaydi.
        </p>
      </div>
      <ProductEditor categories={categories} />
    </div>
  );
}
