import Link from "next/link";

export function Pagination({
  page,
  totalPages,
  searchParams,
}: {
  page: number;
  totalPages: number;
  searchParams: Record<string, string | undefined>;
}): React.ReactNode {
  if (totalPages <= 1) {
    return null;
  }

  const createHref = (target: number): string => {
    const params = new URLSearchParams();

    Object.entries(searchParams).forEach(([key, value]) => {
      if (value !== undefined && key !== "page") {
        params.set(key, value);
      }
    });
    params.set("page", String(target));

    return `?${params.toString()}`;
  };

  return (
    <nav className="pagination" aria-label="Sahifalar">
      <Link
        aria-disabled={page <= 1}
        className={page <= 1 ? "disabled" : ""}
        href={page <= 1 ? "#" : createHref(page - 1)}
      >
        Oldingi
      </Link>
      <span>
        {page} / {totalPages}
      </span>
      <Link
        aria-disabled={page >= totalPages}
        className={page >= totalPages ? "disabled" : ""}
        href={
          page >= totalPages ? "#" : createHref(page + 1)
        }
      >
        Keyingi
      </Link>
    </nav>
  );
}
