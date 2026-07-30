import type { ReactNode } from "react";

export function LoadingState({
  label = "Mahsulotlar yuklanmoqda",
}: {
  label?: string;
}): ReactNode {
  return (
    <div
      aria-busy="true"
      aria-label={label}
      className="grid grid-cols-2 gap-3"
      role="status"
    >
      {[0, 1, 2, 3].map((item) => (
        <div
          className="surface overflow-hidden rounded-[1.4rem] p-2"
          key={item}
        >
          <div className="skeleton aspect-[4/5] rounded-[1rem]" />
          <div className="skeleton mt-3 h-4 w-4/5 rounded-full" />
          <div className="skeleton mt-2 h-4 w-1/2 rounded-full" />
        </div>
      ))}
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}): ReactNode {
  return (
    <div className="surface rounded-[1.5rem] px-5 py-10 text-center">
      <div aria-hidden="true" className="text-4xl">
        🧸
      </div>
      <h3 className="mt-3 text-base font-extrabold">{title}</h3>
      <p className="text-muted mt-2 text-sm leading-6">{description}</p>
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}): ReactNode {
  return (
    <div
      className="surface rounded-[1.5rem] border border-red-300/60 px-5 py-8 text-center"
      role="alert"
    >
      <div aria-hidden="true" className="text-3xl">
        🌧️
      </div>
      <h3 className="mt-3 text-base font-extrabold">
        Ma’lumotni yuklab bo‘lmadi
      </h3>
      <p className="text-muted mt-2 text-sm leading-6">{message}</p>
      {onRetry ? (
        <button
          className="focus-ring mt-5 rounded-full bg-[var(--brand-purple)] px-5 py-2.5 text-sm font-bold text-white"
          onClick={onRetry}
          type="button"
        >
          Qayta urinish
        </button>
      ) : null}
    </div>
  );
}
