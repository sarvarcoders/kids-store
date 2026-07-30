import Link from "next/link";
import { notFound } from "next/navigation";

import { getAdminCustomer } from "@/lib/customers/customers.service";
import {
  formatAdminDate,
  formatAdminOrderStatus,
  formatAdminPrice,
} from "@/lib/format/display";

export const dynamic = "force-dynamic";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.ReactNode> {
  const customer = await getAdminCustomer((await params).id);

  if (!customer) {
    notFound();
  }

  return (
    <div className="page-stack">
      <section className="detail-header">
        <div>
          <span>Mijoz</span>
          <h2>{customer.firstName}</h2>
          <p>
            {customer.username
              ? `@${customer.username}`
              : customer.telegramUserId}
          </p>
        </div>
        <strong className="detail-total">
          {formatAdminPrice(customer.totalSpent)}
        </strong>
      </section>
      <section className="detail-grid">
        <article className="panel">
          <div className="panel-heading">
            <h2>Kontakt</h2>
          </div>
          <dl className="detail-list">
            <div>
              <dt>Telegram ID</dt>
              <dd>{customer.telegramUserId}</dd>
            </div>
            <div>
              <dt>Telefon</dt>
              <dd>{customer.phone ?? "—"}</dd>
            </div>
            <div>
              <dt>Ro‘yxatdan o‘tgan</dt>
              <dd>{formatAdminDate(customer.createdAt)}</dd>
            </div>
          </dl>
        </article>
        <article className="panel">
          <div className="panel-heading">
            <h2>Savatcha holati</h2>
          </div>
          {customer.cart ? (
            <>
              <strong>{customer.cart.items.length} ta pozitsiya</strong>
              <ul className="activity-list compact">
                {customer.cart.items.map((item) => (
                  <li key={item.id}>
                    <div>
                      <strong>
                        {item.productVariant.product.name}
                      </strong>
                      <small>
                        {item.productVariant.size} /{" "}
                        {item.productVariant.color} · {item.quantity} dona
                      </small>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="hint">Faol savatcha yo‘q.</p>
          )}
        </article>
      </section>
      <section className="panel">
        <div className="panel-heading">
          <h2>Buyurtmalar tarixi</h2>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Sana</th>
                <th>Status</th>
                <th>Summa</th>
              </tr>
            </thead>
            <tbody>
              {customer.orders.map((order) => (
                <tr key={order.id}>
                  <td>
                    <Link href={`/orders/${String(order.id)}`}>
                      #{order.id}
                    </Link>
                  </td>
                  <td>{formatAdminDate(order.createdAt)}</td>
                  <td>{formatAdminOrderStatus(order.status)}</td>
                  <td>{formatAdminPrice(order.totalAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
