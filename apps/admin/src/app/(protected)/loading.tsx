export default function Loading(): React.ReactNode {
  return (
    <div className="loading-grid" aria-label="Yuklanmoqda">
      {Array.from({ length: 6 }, (_, index) => (
        <div className="skeleton" key={index} />
      ))}
    </div>
  );
}
