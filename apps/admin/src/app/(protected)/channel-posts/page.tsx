import Link from "next/link";

import { Pagination } from "@/components/ui/pagination";
import { normalizePageSearchParams } from "@/lib/api/page-query";
import { listAdminChannelPosts } from "@/lib/channel/channel-posts.service";
import { formatAdminDate } from "@/lib/format/display";

export const dynamic = "force-dynamic";

export default async function ChannelPostsPage({
  searchParams,
}: {
  searchParams: Promise<
    Record<string, string | string[] | undefined>
  >;
}): Promise<React.ReactNode> {
  const query = normalizePageSearchParams(await searchParams);
  const result = await listAdminChannelPosts(query);

  return (
    <div className="page-stack">
      <section className="toolbar">
        <form className="filter-grid" method="get">
          <label>
            Mahsulot
            <select defaultValue={query.productId ?? ""} name="productId">
              <option value="">Barchasi</option>
              {result.products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Kanal ID
            <input
              defaultValue={query.channelId}
              maxLength={100}
              name="channelId"
            />
          </label>
          <label>
            Dan
            <input
              defaultValue={query.dateFrom}
              name="dateFrom"
              type="date"
            />
          </label>
          <label>
            Gacha
            <input
              defaultValue={query.dateTo}
              name="dateTo"
              type="date"
            />
          </label>
          <button className="secondary-button" type="submit">
            Filtrlash
          </button>
        </form>
      </section>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <span>Telegram</span>
            <h2>Kanal postlari</h2>
          </div>
          <strong>{result.pagination.total} ta</strong>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Mahsulot</th>
                <th>Kanal ID</th>
                <th>Message ID</th>
                <th>Sana</th>
                <th>Admin</th>
                <th>Havola</th>
              </tr>
            </thead>
            <tbody>
              {result.data.length === 0 ? (
                <tr>
                  <td className="empty-row" colSpan={6}>
                    Kanal posti topilmadi.
                  </td>
                </tr>
              ) : null}
              {result.data.map((post) => (
                <tr key={post.id}>
                  <td>
                    <Link
                      href={`/products/${String(post.product.id)}/edit`}
                    >
                      <strong>{post.product.name}</strong>
                    </Link>
                    <small>{post.product.code}</small>
                  </td>
                  <td>{post.channelId}</td>
                  <td>{post.messageId}</td>
                  <td>{formatAdminDate(post.createdAt)}</td>
                  <td>{post.publishedBy ?? "—"}</td>
                  <td>
                    {post.postUrl ? (
                      <a
                        href={post.postUrl}
                        rel="noreferrer"
                        target="_blank"
                      >
                        Ochish ↗
                      </a>
                    ) : (
                      "—"
                    )}
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
