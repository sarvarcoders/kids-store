"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createCategorySlug } from "@kids-store/shared";

import { useAdminAuth } from "@/components/auth/admin-auth-provider";

interface CategoryRow {
  id: number;
  name: string;
  slug: string;
  productsCount: number;
}

export function CategoryManager({
  categories,
}: {
  categories: CategoryRow[];
}): React.ReactNode {
  const { request } = useAdminAuth();
  const router = useRouter();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startCreate = (): void => {
    setEditingId(null);
    setName("");
    setSlug("");
    setError(null);
  };

  const startEdit = (category: CategoryRow): void => {
    setEditingId(category.id);
    setName(category.name);
    setSlug(category.slug);
    setError(null);
  };

  const submit = async (
    event: React.SyntheticEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      await request(
        editingId === null
          ? "/api/admin/categories"
          : `/api/admin/categories/${String(editingId)}`,
        {
          method: editingId === null ? "POST" : "PATCH",
          body: { name, slug },
          idempotent: true,
        },
      );
      startCreate();
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Kategoriyani saqlab bo‘lmadi.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="split-grid categories-grid">
      <section className="panel">
        <div className="panel-heading">
          <div>
            <span>Katalog</span>
            <h2>Kategoriyalar</h2>
          </div>
          <strong>{categories.length} ta</strong>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Nomi</th>
                <th>Slug</th>
                <th>Mahsulotlar</th>
                <th>Amal</th>
              </tr>
            </thead>
            <tbody>
              {categories.length === 0 ? (
                <tr>
                  <td className="empty-row" colSpan={4}>
                    Kategoriya hali yaratilmagan.
                  </td>
                </tr>
              ) : null}
              {categories.map((category) => (
                <tr key={category.id}>
                  <td>
                    <strong>{category.name}</strong>
                  </td>
                  <td>{category.slug}</td>
                  <td>{category.productsCount}</td>
                  <td>
                    <button
                      className="table-action"
                      onClick={() => { startEdit(category); }}
                      type="button"
                    >
                      Tahrirlash
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="hint">
          Bog‘langan mahsulotlar xavfsizligi uchun hard delete mavjud emas.
        </p>
      </section>
      <form className="panel category-form" onSubmit={(event) => void submit(event)}>
        <div className="panel-heading">
          <div>
            <span>{editingId === null ? "Yangi" : "Tahrirlash"}</span>
            <h2>Kategoriya</h2>
          </div>
        </div>
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <label>
          Nomi
          <input
            maxLength={120}
            onChange={(event) => {
              const nextName = event.target.value;
              setName(nextName);

              if (editingId === null) {
                setSlug(createCategorySlug(nextName));
              }
            }}
            required
            value={name}
          />
        </label>
        <label>
          Katalog manzili (avtomatik)
          <input
            maxLength={160}
            placeholder="Kategoriya nomidan avtomatik yaratiladi"
            readOnly
            value={slug}
          />
        </label>
        <p className="hint">
          Bu texnik manzil katalog filtrlari uchun ishlatiladi. Uni
          qo‘lda yozish shart emas.
        </p>
        <div className="form-actions">
          {editingId !== null ? (
            <button
              className="secondary-button"
              onClick={startCreate}
              type="button"
            >
              Bekor qilish
            </button>
          ) : null}
          <button className="primary-button" disabled={busy} type="submit">
            {busy ? "Saqlanmoqda…" : "Saqlash"}
          </button>
        </div>
      </form>
    </div>
  );
}
