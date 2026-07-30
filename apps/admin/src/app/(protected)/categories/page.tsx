import { CategoryManager } from "@/components/categories/category-manager";
import { listAdminCategories } from "@/lib/categories/categories.service";

export const dynamic = "force-dynamic";

export default async function CategoriesPage(): Promise<React.ReactNode> {
  const categories = await listAdminCategories();

  return (
    <CategoryManager
      categories={categories.map((category) => ({
        id: category.id,
        name: category.name,
        slug: category.slug,
        productsCount: category._count.products,
      }))}
    />
  );
}
