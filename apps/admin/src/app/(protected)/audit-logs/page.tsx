import { formatSafeAuditMetadata } from "@/lib/audit/metadata";
import { listAdminAuditLogs } from "@/lib/audit/audit.service";
import { normalizePageSearchParams } from "@/lib/api/page-query";
import { formatAdminDate } from "@/lib/format/display";
import { Pagination } from "@/components/ui/pagination";

export const dynamic = "force-dynamic";

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<
    Record<string, string | string[] | undefined>
  >;
}): Promise<React.ReactNode> {
  const query = normalizePageSearchParams(await searchParams);
  const result = await listAdminAuditLogs(query);

  return (
    <div className="page-stack">
      <section className="toolbar">
        <form className="filter-grid" method="get">
          <label>
            Admin Telegram ID
            <input
              defaultValue={query.adminTelegramId}
              name="adminTelegramId"
            />
          </label>
          <label>
            Action
            <input
              defaultValue={query.action}
              maxLength={80}
              name="action"
            />
          </label>
          <label>
            Entity turi
            <input
              defaultValue={query.entityType}
              maxLength={80}
              name="entityType"
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
            <span>Append-only</span>
            <h2>Audit log</h2>
          </div>
          <strong>{result.pagination.total} ta</strong>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Vaqt</th>
                <th>Admin</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Metadata</th>
              </tr>
            </thead>
            <tbody>
              {result.data.length === 0 ? (
                <tr>
                  <td className="empty-row" colSpan={5}>
                    Audit yozuvi topilmadi.
                  </td>
                </tr>
              ) : null}
              {result.data.map((entry) => (
                <tr key={entry.id}>
                  <td>{formatAdminDate(entry.createdAt)}</td>
                  <td>{entry.adminTelegramId}</td>
                  <td>
                    <code>{entry.action}</code>
                  </td>
                  <td>
                    {entry.entityType} #{entry.entityId}
                  </td>
                  <td>
                    <code className="metadata-code">
                      {formatSafeAuditMetadata(entry.metadata)}
                    </code>
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
