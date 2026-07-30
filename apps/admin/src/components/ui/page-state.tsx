export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}): React.ReactNode {
  return (
    <section className="state-card">
      <span aria-hidden="true">□</span>
      <h2>{title}</h2>
      <p>{description}</p>
    </section>
  );
}

export function ErrorState({
  message = "Ma’lumotni yuklab bo‘lmadi.",
}: {
  message?: string;
}): React.ReactNode {
  return (
    <section className="state-card error-state" role="alert">
      <span aria-hidden="true">!</span>
      <h2>Xatolik</h2>
      <p>{message}</p>
    </section>
  );
}
