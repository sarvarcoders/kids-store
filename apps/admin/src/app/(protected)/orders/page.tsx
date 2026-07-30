import Link from "next/link";

import { Pagination } from "@/components/ui/pagination";
import { normalizePageSearchParams } from "@/lib/api/page-query";
import {
  formatAdminDate,
  formatAdminOrderStatus,
  formatAdminPrice,
} from "@/lib/format/display";
import { listAdminOrders } from "@/lib/orders/orders.service";

export const dynamic = "force-dynamic";

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<
    Record<string, string | string[] | undefined>
  >;
}): Promise<React.ReactNode> {
  const query = normalizePageSearchParams(await searchParams);
  const result = await listAdminOrders(query);

  return (
    <div className="page-stack">
      <section className="toolbar">
        <form className="filter-grid" method="get">
          <label>
            Buyurtma ID
            <input
              defaultValue={query.orderId}
              min={1}
              name="orderId"
              type="number"
            />
          </label>
          <label>
            Mijoz
            <input
              defaultValue={query.customer}
              maxLength={100}
              name="customer"
              placeholder="Ism, username, telefon"
            />
          </label>
          <label>
            Status
            <select defaultValue={query.status ?? ""} name="status">
              <option value="">Barchasi</option>
              {[
                "PENDING",
                "CONFIRMED",
                "PROCESSING",
                "SHIPPED",
                "DELIVERED",
                "CANCELLED",
              ].map((status) => (
                <option key={status} value={status}>
                  {formatAdminOrderStatus(status)}
                </option>
              ))}
            </select>
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
          <label>
            Min summa
            <input
              defaultValue={query.minAmount}
              min={0}
              name="minAmount"
              type="number"
            />
          </label>
          <label>
            Max summa
            <input
              defaultValue={query.maxAmount}
              min={0}
              name="maxAmount"
              type="number"
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
            <span>Savdo</span>
            <h2>Buyurtmalar</h2>
          </div>
          <strong>{result.pagination.total} ta</strong>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>ID / sana</th>
                <th>Mijoz</th>
                <th>Telefon</th>
                <th>Mahsulotlar</th>
                <th>Summa</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {result.data.length === 0 ? (
                <tr>
                  <td className="empty-row" colSpan={6}>
                    Filtrga mos buyurtma topilmadi.
                  </td>
                </tr>
              ) : null}
              {result.data.map((order) => (
                <tr key={order.id}>
                  <td>
                    <Link href={`/orders/${String(order.id)}`}>
                      <strong>#{order.id}</strong>
                    </Link>
                    <small>{formatAdminDate(order.createdAt)}</small>
                  </td>
                  <td>{order.customer.name}</td>
                  <td>{order.customer.phone ?? "—"}</td>
                  <td>{order.itemsCount}</td>
                  <td>{formatAdminPrice(order.totalAmount)}</td>
                  <td>
                    <span
                      className={`status status-${order.status.toLowerCase()}`}
                    >
                      {formatAdminOrderStatus(order.status)}
                    </span>
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
