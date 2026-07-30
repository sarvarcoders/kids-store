"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { useAdminAuth } from "@/components/auth/admin-auth-provider";

interface EditorProduct {
  id?: number;
  code: string;
  name: string;
  slug: string;
  description: string | null;
  categoryId: number;
  price: number;
  discountPrice: number | null;
  isActive: boolean;
  images: {
    id?: number;
    url: string;
    sortOrder: number;
  }[];
  variants: {
    id?: number;
    size: string;
    color: string;
    stock: number;
  }[];
}

export function ProductEditor({
  categories,
  initialProduct,
}: {
  categories: { id: number; name: string }[];
  initialProduct?: EditorProduct;
}): React.ReactNode {
  const { request } = useAdminAuth();
  const router = useRouter();
  const [product, setProduct] = useState<EditorProduct>(
    initialProduct ?? {
      code: "",
      name: "",
      slug: "",
      description: null,
      categoryId: categories[0]?.id ?? 0,
      price: 0,
      discountPrice: null,
      isActive: true,
      images: [],
      variants: [{ size: "", color: "", stock: 0 }],
    },
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (
    event: React.SyntheticEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      await request(
        initialProduct?.id
          ? `/api/admin/products/${String(initialProduct.id)}`
          : "/api/admin/products",
        {
          method: initialProduct?.id ? "PATCH" : "POST",
          idempotent: true,
          body: product,
        },
      );
      router.push("/products");
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Mahsulotni saqlab bo‘lmadi.",
      );
    } finally {
      setBusy(false);
    }
  };

  const publish = async (): Promise<void> => {
    if (initialProduct?.id === undefined) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const result = await request<{
        data: {
          telegramMessageId: number;
          postUrl: string | null;
        };
      }>(
        `/api/admin/products/${String(initialProduct.id)}/publish`,
        {
          method: "POST",
          idempotent: true,
        },
      );
      window.alert(
        result.data.postUrl
          ? `Post yuborildi: ${result.data.postUrl}`
          : `Post yuborildi. Message ID: ${String(result.data.telegramMessageId)}`,
      );
      router.refresh();
    } catch (publishError) {
      setError(
        publishError instanceof Error
          ? publishError.message
          : "Mahsulotni kanalga chiqarib bo‘lmadi.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="editor-form" onSubmit={(event) => void submit(event)}>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <section className="panel form-section">
        <div className="panel-heading">
          <div>
            <span>Asosiy ma’lumotlar</span>
            <h2>Mahsulot</h2>
          </div>
        </div>
        <div className="form-grid">
          <label>
            Kod
            <input
              maxLength={64}
              onChange={(event) =>
                { setProduct({ ...product, code: event.target.value }); }
              }
              required
              value={product.code}
            />
          </label>
          <label>
            Nomi
            <input
              maxLength={160}
              onChange={(event) =>
                { setProduct({ ...product, name: event.target.value }); }
              }
              required
              value={product.name}
            />
          </label>
          <label>
            Slug
            <input
              maxLength={200}
              onChange={(event) =>
                { setProduct({ ...product, slug: event.target.value }); }
              }
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              required
              value={product.slug}
            />
          </label>
          <label>
            Kategoriya
            <select
              onChange={(event) =>
                { setProduct({
                  ...product,
                  categoryId: Number(event.target.value),
                }); }
              }
              required
              value={product.categoryId}
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Asosiy narx
            <input
              min={0}
              onChange={(event) =>
                { setProduct({
                  ...product,
                  price: Number(event.target.value),
                }); }
              }
              required
              type="number"
              value={product.price}
            />
          </label>
          <label>
            Chegirmali narx
            <input
              min={0}
              onChange={(event) =>
                { setProduct({
                  ...product,
                  discountPrice:
                    event.target.value === ""
                      ? null
                      : Number(event.target.value),
                }); }
              }
              type="number"
              value={product.discountPrice ?? ""}
            />
          </label>
          <label className="wide-field">
            Tavsif
            <textarea
              maxLength={5_000}
              onChange={(event) =>
                { setProduct({
                  ...product,
                  description: event.target.value || null,
                }); }
              }
              rows={5}
              value={product.description ?? ""}
            />
          </label>
          <label className="check-filter wide-field">
            <input
              checked={product.isActive}
              onChange={(event) =>
                { setProduct({
                  ...product,
                  isActive: event.target.checked,
                }); }
              }
              type="checkbox"
            />
            Faol mahsulot
          </label>
        </div>
      </section>
      <section className="panel form-section">
        <div className="panel-heading">
          <div>
            <span>HTTPS URL · maksimal 8 ta</span>
            <h2>Rasmlar</h2>
          </div>
          <button
            className="secondary-button"
            disabled={product.images.length >= 8}
            onClick={() =>
              { setProduct({
                ...product,
                images: [
                  ...product.images,
                  { url: "", sortOrder: product.images.length },
                ],
              }); }
            }
            type="button"
          >
            + Rasm
          </button>
        </div>
        <div className="repeat-list">
          {product.images.map((image, index) => (
            <div className="repeat-row image-row" key={image.id ?? index}>
              <label>
                URL
                <input
                  onChange={(event) => {
                    const images = [...product.images];
                    const current = images[index];

                    if (current) {
                      images[index] = {
                        ...current,
                        url: event.target.value,
                      };
                      setProduct({ ...product, images });
                    }
                  }}
                  placeholder="https://placehold.co/..."
                  required
                  type="url"
                  value={image.url}
                />
              </label>
              <label>
                Tartib
                <input
                  max={7}
                  min={0}
                  onChange={(event) => {
                    const images = [...product.images];
                    const current = images[index];

                    if (current) {
                      images[index] = {
                        ...current,
                        sortOrder: Number(event.target.value),
                      };
                      setProduct({ ...product, images });
                    }
                  }}
                  required
                  type="number"
                  value={image.sortOrder}
                />
              </label>
              <button
                className="danger-button"
                onClick={() =>
                  { setProduct({
                    ...product,
                    images: product.images.filter(
                      (_, itemIndex) => itemIndex !== index,
                    ),
                  }); }
                }
                type="button"
              >
                Olib tashlash
              </button>
            </div>
          ))}
          {product.images.length === 0 ? (
            <p className="hint">
              Rasm majburiy emas, lekin kamida bittasi tavsiya qilinadi.
            </p>
          ) : null}
        </div>
      </section>
      <section className="panel form-section">
        <div className="panel-heading">
          <div>
            <span>Kamida bitta variant</span>
            <h2>O‘lcham, rang va stock</h2>
          </div>
          <button
            className="secondary-button"
            onClick={() =>
              { setProduct({
                ...product,
                variants: [
                  ...product.variants,
                  { size: "", color: "", stock: 0 },
                ],
              }); }
            }
            type="button"
          >
            + Variant
          </button>
        </div>
        <div className="repeat-list">
          {product.variants.map((variant, index) => (
            <div className="repeat-row" key={variant.id ?? index}>
              {(["size", "color"] as const).map((field) => (
                <label key={field}>
                  {field === "size" ? "O‘lcham" : "Rang"}
                  <input
                    maxLength={field === "size" ? 50 : 80}
                    onChange={(event) => {
                      const variants = [...product.variants];
                      const current = variants[index];

                      if (current) {
                        variants[index] = {
                          ...current,
                          [field]: event.target.value,
                        };
                        setProduct({ ...product, variants });
                      }
                    }}
                    required
                    value={variant[field]}
                  />
                </label>
              ))}
              <label>
                Stock
                <input
                  min={0}
                  onChange={(event) => {
                    const variants = [...product.variants];
                    const current = variants[index];

                    if (current) {
                      variants[index] = {
                        ...current,
                        stock: Number(event.target.value),
                      };
                      setProduct({ ...product, variants });
                    }
                  }}
                  required
                  type="number"
                  value={variant.stock}
                />
              </label>
              <button
                className="danger-button"
                disabled={product.variants.length === 1}
                onClick={() =>
                  { setProduct({
                    ...product,
                    variants: product.variants.filter(
                      (_, itemIndex) => itemIndex !== index,
                    ),
                  }); }
                }
                type="button"
              >
                Olib tashlash
              </button>
            </div>
          ))}
        </div>
      </section>
      <div className="form-actions">
        {initialProduct?.id !== undefined ? (
          <button
            className="secondary-button"
            disabled={busy || !product.isActive}
            onClick={() => {
              void publish();
            }}
            type="button"
          >
            Telegram kanaliga chiqarish
          </button>
        ) : null}
        <button
          className="secondary-button"
          onClick={() => { router.back(); }}
          type="button"
        >
          Bekor qilish
        </button>
        <button className="primary-button" disabled={busy} type="submit">
          {busy ? "Saqlanmoqda…" : "Saqlash"}
        </button>
      </div>
    </form>
  );
}
