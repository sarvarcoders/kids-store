import Link from "next/link";

import { Pagination } from "@/components/ui/pagination";
import { normalizePageSearchParams } from "@/lib/api/page-query";
import {
  formatAdminDate,
  formatAdminPrice,
} from "@/lib/format/display";
import { listAdminCustomers } from "@/lib/customers/customers.service";

export const dynamic = "force-dynamic";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<
    Record<string, string | string[] | undefined>
  >;
}): Promise<React.ReactNode> {
  const query = normalizePageSearchParams(await searchParams);
  const result = await listAdminCustomers(query);

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
              placeholder="Ism, username, telefon yoki Telegram ID"
            />
          </label>
          <button className="secondary-button" type="submit">
            Qidirish
          </button>
        </form>
      </section>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <span>CRM</span>
            <h2>Mijozlar</h2>
          </div>
          <strong>{result.pagination.total} ta</strong>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Mijoz</th>
                <th>Telegram ID</th>
                <th>Telefon</th>
                <th>Buyurtmalar</th>
                <th>Jami xarid</th>
                <th>Oxirgi buyurtma</th>
              </tr>
            </thead>
            <tbody>
              {result.data.length === 0 ? (
                <tr>
                  <td className="empty-row" colSpan={6}>
                    Mijoz topilmadi.
                  </td>
                </tr>
              ) : null}
              {result.data.map((customer) => (
                <tr key={customer.id}>
                  <td>
                    <Link href={`/customers/${String(customer.id)}`}>
                      <strong>{customer.firstName}</strong>
                    </Link>
                    <small>
                      {customer.username
                        ? `@${customer.username}`
                        : "username yo‘q"}
                    </small>
                  </td>
                  <td>{customer.telegramUserId}</td>
                  <td>{customer.phone ?? "—"}</td>
                  <td>{customer.orderCount}</td>
                  <td>{formatAdminPrice(customer.totalSpent)}</td>
                  <td>
                    {customer.lastOrderAt
                      ? formatAdminDate(customer.lastOrderAt)
                      : "—"}
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
