interface PreviewVariant {
  color: string;
  size: string;
}

function formatPrice(value: number): string {
  return `${new Intl.NumberFormat("uz-UZ").format(value)} so‘m`;
}

function formatUniqueValues(values: string[]): string {
  const formatted = Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean)),
  ).join(", ");

  return formatted.length > 0 ? formatted : "—";
}

export function ProductChannelPreview({
  code,
  description,
  discountPrice,
  name,
  price,
  variants,
}: {
  code: string;
  description: string | null;
  discountPrice: number | null;
  name: string;
  price: number | null;
  variants: PreviewVariant[];
}): React.ReactNode {
  return (
    <section className="panel channel-preview">
      <div className="panel-heading">
        <div>
          <span>Telegram preview</span>
          <h2>Kanal posti ko‘rinishi</h2>
        </div>
      </div>
      <div className="channel-preview-card">
        <strong>{name.trim().length > 0 ? name : "Mahsulot nomi"}</strong>
        <span>Kod: {code.trim().length > 0 ? code : "—"}</span>
        <p>
          {description && description.trim().length > 0
            ? description
            : "Mahsulot tavsifi"}
        </p>
        {price === null ? (
          <b>Narx kiritilmagan</b>
        ) : discountPrice !== null ? (
          <>
            <s>{formatPrice(price)}</s>
            <b>{formatPrice(discountPrice)}</b>
          </>
        ) : (
          <b>{formatPrice(price)}</b>
        )}
        <small>
          O‘lchamlar: {formatUniqueValues(variants.map((item) => item.size))}
        </small>
        <small>
          Ranglar: {formatUniqueValues(variants.map((item) => item.color))}
        </small>
        <em>🛍 Sotib olish tugmasi deep link bilan qo‘shiladi.</em>
      </div>
    </section>
  );
}
