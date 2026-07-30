import Image from "next/image";
import Link from "next/link";

import { ProductActions } from "@/components/products/product-actions";
import { Pagination } from "@/components/ui/pagination";
import { normalizePageSearchParams } from "@/lib/api/page-query";
import { formatAdminPrice } from "@/lib/format/display";
import { listAdminProducts } from "@/lib/products/products.service";

export const dynamic = "force-dynamic";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<
    Record<string, string | string[] | undefined>
  >;
}): Promise<React.ReactNode> {
  const query = normalizePageSearchParams(await searchParams);
  const result = await listAdminProducts(query);

  return (
    <div className="page-stack">
      <section className="toolbar">
        <form className="filter-grid" method="get">
          <label>
            Qidiruv
            <input
              defaultValue={query.search}
              maxLength={100}
              name="search"
              placeholder="Kod yoki nom"
            />
          </label>
          <label>
            Kategoriya
            <select defaultValue={query.categoryId ?? ""} name="categoryId">
              <option value="">Barchasi</option>
              {result.categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Holati
            <select defaultValue={query.active ?? ""} name="active">
              <option value="">Barchasi</option>
              <option value="true">Faol</option>
              <option value="false">Arxiv</option>
            </select>
          </label>
          <label>
            Saralash
            <select defaultValue={query.sort ?? "newest"} name="sort">
              <option value="newest">Yangi avval</option>
              <option value="oldest">Eski avval</option>
              <option value="name">Nom bo‘yicha</option>
              <option value="price_asc">Narx o‘sish</option>
              <option value="price_desc">Narx kamayish</option>
            </select>
          </label>
          <label className="check-filter">
            <input
              defaultChecked={query.discount === "true"}
              name="discount"
              type="checkbox"
              value="true"
            />
            Faqat chegirmali
          </label>
          <label className="check-filter">
            <input
              defaultChecked={query.lowStock === "true"}
              name="lowStock"
              type="checkbox"
              value="true"
            />
            Kam qoldiq
          </label>
          <button className="secondary-button" type="submit">
            Filtrlash
          </button>
        </form>
        <Link className="primary-button" href="/products/new">
          + Yangi mahsulot
        </Link>
      </section>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <span>Katalog boshqaruvi</span>
            <h2>Mahsulotlar</h2>
          </div>
          <strong>{result.pagination.total} ta</strong>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Mahsulot</th>
                <th>Kategoriya</th>
                <th>Narx</th>
                <th>Variant / stock</th>
                <th>Holat</th>
                <th>Amallar</th>
              </tr>
            </thead>
            <tbody>
              {result.data.length === 0 ? (
                <tr>
                  <td className="empty-row" colSpan={6}>
                    Filtrga mos mahsulot topilmadi.
                  </td>
                </tr>
              ) : null}
              {result.data.map((product) => (
                <tr key={product.id}>
                  <td>
                    <div className="product-cell">
                      {product.primaryImage ? (
                        <Image
                          alt={product.name}
                          height={52}
                          src={product.primaryImage}
                          width={52}
                        />
                      ) : (
                        <span className="image-placeholder">□</span>
                      )}
                      <div>
                        <strong>{product.name}</strong>
                        <small>{product.code}</small>
                      </div>
                    </div>
                  </td>
                  <td>{product.category.name}</td>
                  <td>
                    <strong>
                      {formatAdminPrice(
                        product.discountPrice ?? product.price,
                      )}
                    </strong>
                    {product.discountPrice !== null ? (
                      <small className="old-price">
                        {formatAdminPrice(product.price)}
                      </small>
                    ) : null}
                  </td>
                  <td>
                    {product.variantsCount} / {product.totalStock}
                  </td>
                  <td>
                    <span
                      className={`status ${
                        product.isActive
                          ? "status-active"
                          : "status-cancelled"
                      }`}
                    >
                      {product.isActive ? "Faol" : "Arxiv"}
                    </span>
                  </td>
                  <td>
                    <ProductActions
                      id={product.id}
                      isActive={product.isActive}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <Pagination
        page={result.pagination.page}
        searchParams={query}
        totalPages={result.pagination.totalPages}
      />
    </div>
  );
}
