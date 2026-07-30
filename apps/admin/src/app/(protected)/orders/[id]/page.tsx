import { notFound } from "next/navigation";

import { OrderStatusControl } from "@/components/orders/order-status-control";
import {
  formatAdminDate,
  formatAdminOrderStatus,
  formatAdminPrice,
} from "@/lib/format/display";
import { getAllowedOrderStatuses } from "@/lib/orders/order-transitions";
import { getAdminOrder } from "@/lib/orders/orders.service";
import { formatSafeAuditMetadata } from "@/lib/audit/metadata";

export const dynamic = "force-dynamic";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.ReactNode> {
  const order = await getAdminOrder((await params).id);

  if (!order) {
    notFound();
  }

  const allowed = getAllowedOrderStatuses(order.status);

  return (
    <div className="page-stack">
      <section className="detail-header">
        <div>
          <span>Buyurtma</span>
          <h2>#{order.id}</h2>
          <p>
            {formatAdminDate(order.createdAt)} ·{" "}
            {formatAdminOrderStatus(order.status)}
          </p>
        </div>
        <strong className="detail-total">
          {formatAdminPrice(order.totalAmount)}
        </strong>
      </section>
      <section className="detail-grid">
        <article className="panel">
          <div className="panel-heading">
            <h2>Mijoz va yetkazib berish</h2>
          </div>
          <dl className="detail-list">
            <div>
              <dt>Mijoz</dt>
              <dd>{order.customer.firstName}</dd>
            </div>
            <div>
              <dt>Telegram</dt>
              <dd>
                {order.customer.username
                  ? `@${order.customer.username}`
                  : order.customer.telegramUserId}
              </dd>
            </div>
            <div>
              <dt>Telefon</dt>
              <dd>{order.customer.phone ?? "—"}</dd>
            </div>
            <div>
              <dt>Manzil</dt>
              <dd>{order.deliveryAddress ?? "—"}</dd>
            </div>
            <div>
              <dt>Yangilangan</dt>
              <dd>{formatAdminDate(order.updatedAt)}</dd>
            </div>
          </dl>
        </article>
        <article className="panel">
          <div className="panel-heading">
            <h2>Status boshqaruvi</h2>
          </div>
          <OrderStatusControl
            allowedStatuses={allowed}
            currentStatus={order.status}
            orderId={order.id}
          />
          <p className="hint">
            Bekor qilish faqat yangi yoki tasdiqlangan buyurtmada
            mavjud. Stock faqat bir marta qaytariladi.
          </p>
        </article>
      </section>
      <section className="panel">
        <div className="panel-heading">
          <h2>Buyurtma tarkibi</h2>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Mahsulot</th>
                <th>Variant</th>
                <th>Miqdor</th>
                <th>Dona narxi</th>
                <th>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.productVariant.product.name}</strong>
                    <small>{item.productVariant.product.code}</small>
                  </td>
                  <td>
                    {item.productVariant.size} /{" "}
                    {item.productVariant.color}
                  </td>
                  <td>{item.quantity}</td>
                  <td>{formatAdminPrice(item.unitPrice)}</td>
                  <td>{formatAdminPrice(item.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel">
        <div className="panel-heading">
          <h2>Status tarixi</h2>
        </div>
        {order.history.length > 0 ? (
          <ul className="activity-list">
            {order.history.map((entry) => (
              <li key={entry.id}>
                <span className="activity-icon">≡</span>
                <div>
                  <strong>{entry.action}</strong>
                  <small>
                    Admin {entry.adminTelegramId} ·{" "}
                    {formatAdminDate(entry.createdAt)}
                  </small>
                  <small>
                    {formatSafeAuditMetadata(entry.metadata)}
                  </small>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="hint">Status tarixi hali mavjud emas.</p>
        )}
      </section>
    </div>
  );
}
