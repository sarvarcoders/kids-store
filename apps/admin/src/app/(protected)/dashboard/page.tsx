import Link from "next/link";

import { getAdminDashboard } from "@/lib/dashboard/dashboard.service";
import {
  formatAdminDate,
  formatAdminOrderStatus,
  formatAdminPrice,
} from "@/lib/format/display";

export const dynamic = "force-dynamic";

export default async function DashboardPage(): Promise<React.ReactNode> {
  const dashboard = await getAdminDashboard();
  const metrics = [
    {
      label: "Bugungi buyurtmalar",
      value: String(dashboard.metrics.todayOrders),
      accent: "blue",
    },
    {
      label: "Bugungi tushum",
      value: formatAdminPrice(dashboard.metrics.todayRevenue),
      accent: "green",
    },
    {
      label: "Yangi buyurtmalar",
      value: String(dashboard.metrics.newOrders),
      accent: "orange",
    },
    {
      label: "Faol mahsulotlar",
      value: String(dashboard.metrics.activeProducts),
      accent: "purple",
    },
    {
      label: "Kam qolgan variantlar",
      value: String(dashboard.metrics.lowStockVariants),
      accent: "red",
    },
  ];

  return (
    <div className="page-stack">
      <section className="metric-grid" aria-label="Asosiy ko‘rsatkichlar">
        {metrics.map((metric) => (
          <article
            className={`metric-card ${metric.accent}`}
            key={metric.label}
          >
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
          </article>
        ))}
      </section>
      <section className="split-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <span>Real vaqt</span>
              <h2>Oxirgi buyurtmalar</h2>
            </div>
            <Link href="/orders">Barchasi</Link>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Mijoz</th>
                  <th>Status</th>
                  <th>Summa</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.recentOrders.length === 0 ? (
                  <tr>
                    <td className="empty-row" colSpan={4}>
                      Buyurtmalar hali mavjud emas.
                    </td>
                  </tr>
                ) : null}
                {dashboard.recentOrders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <Link href={`/orders/${String(order.id)}`}>
                        #{order.id}
                      </Link>
                      <small>{formatAdminDate(order.createdAt)}</small>
                    </td>
                    <td>{order.customerName}</td>
                    <td>
                      <span
                        className={`status status-${order.status.toLowerCase()}`}
                      >
                        {formatAdminOrderStatus(order.status)}
                      </span>
                    </td>
                    <td>{formatAdminPrice(order.totalAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
        <article className="panel">
          <div className="panel-heading">
            <div>
              <span>Telegram</span>
              <h2>Oxirgi kanal postlari</h2>
            </div>
            <Link href="/channel-posts">Barchasi</Link>
          </div>
          <ul className="activity-list">
            {dashboard.recentChannelPosts.length === 0 ? (
              <li>
                <div>
                  <strong>Kanal postlari hali mavjud emas.</strong>
                </div>
              </li>
            ) : null}
            {dashboard.recentChannelPosts.map((post) => (
              <li key={post.id}>
                <span className="activity-icon">↗</span>
                <div>
                  <strong>{post.productName}</strong>
                  <small>
                    Message #{post.messageId} ·{" "}
                    {formatAdminDate(post.createdAt)}
                  </small>
                </div>
              </li>
            ))}
          </ul>
        </article>
      </section>
    </div>
  );
}
