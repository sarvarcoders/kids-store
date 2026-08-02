"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { adminProductInputSchema } from "@kids-store/shared";

import { useAdminAuth } from "@/components/auth/admin-auth-provider";
import { ProductChannelPreview } from "@/components/products/product-channel-preview";
import type { EditorProductImage } from "@/components/products/product-image-uploader";
import {
  formatOptionalProductIntegerInput,
  formatProductIntegerInput,
  getProductIntegerPreview,
} from "@/lib/products/product-number-input";

const ProductImageUploader = dynamic(
  () =>
    import("@/components/products/product-image-uploader").then(
      (module) => module.ProductImageUploader,
    ),
  {
    ssr: false,
    loading: () => <p className="hint">Rasm yuklagich tayyorlanmoqda…</p>,
  },
);

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
  images: EditorProductImage[];
  variants: {
    id?: number;
    size: string;
    color: string;
    stock: number;
  }[];
}

interface EditorProductDraft
  extends Omit<EditorProduct, "discountPrice" | "price" | "variants"> {
  discountPrice: string;
  price: string;
  variants: {
    id?: number;
    size: string;
    color: string;
    stock: string;
  }[];
}

interface ProductMutationResponse {
  data: {
    id: number;
    name: string;
  };
}

interface PublishResponse {
  data: {
    telegramMessageId: number;
    postUrl: string | null;
  };
}

function slugifyProductName(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[‘’ʼʻ`']/g, "")
    .toLocaleLowerCase("uz")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 200);
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
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
  const formRef = useRef<HTMLFormElement>(null);
  const [product, setProduct] = useState<EditorProductDraft>(
    initialProduct
      ? {
          ...initialProduct,
          price: formatProductIntegerInput(initialProduct.price),
          discountPrice: formatOptionalProductIntegerInput(
            initialProduct.discountPrice,
          ),
          variants: initialProduct.variants.map((variant) => ({
            ...variant,
            stock: formatProductIntegerInput(variant.stock),
          })),
        }
      : {
          code: "",
          name: "",
          slug: "",
          description: null,
          categoryId: categories[0]?.id ?? 0,
          price: "",
          discountPrice: "",
          isActive: true,
          images: [],
          variants: [{ size: "", color: "", stock: "" }],
        },
  );
  const [draftId] = useState(() => crypto.randomUUID());
  const [productId, setProductId] = useState(initialProduct?.id);
  const [persistedImageUrls, setPersistedImageUrls] = useState(
    () => initialProduct?.images.map((image) => image.url) ?? [],
  );
  const [removedImageUrls, setRemovedImageUrls] = useState<string[]>([]);
  const [slugEdited, setSlugEdited] = useState(
    initialProduct !== undefined,
  );
  const [busy, setBusy] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [postUrl, setPostUrl] = useState<string | null>(null);

  const publishProduct = async (id: number): Promise<PublishResponse> =>
    request<PublishResponse>(
      `/api/admin/products/${String(id)}/publish`,
      {
        method: "POST",
        idempotent: true,
      },
    );

  const cleanupRemovedImages = async (): Promise<number> => {
    const results = await Promise.allSettled(
      removedImageUrls.map((url) =>
        request("/api/admin/uploads/product-images", {
          method: "DELETE",
          body: { url },
        }),
      ),
    );

    return results.filter((result) => result.status === "rejected").length;
  };

  const saveProduct = async (shouldPublish: boolean): Promise<void> => {
    if (busy) {
      return;
    }

    if (uploadingImages) {
      setError("Rasmlar yuklanib bo‘lishini kuting.");
      return;
    }

    if (!formRef.current?.reportValidity()) {
      return;
    }

    if (product.images.length === 0) {
      setError("Kamida bitta mahsulot rasmini yuklang.");
      return;
    }

    const parsedProduct = adminProductInputSchema.safeParse({
      ...product,
      images: product.images.map((image, index) => ({
        ...(image.id === undefined ? {} : { id: image.id }),
        url: image.url,
        sortOrder: index,
      })),
    });

    if (!parsedProduct.success) {
      setError(
        parsedProduct.error.issues[0]?.message ??
          "Mahsulot ma’lumotlarini tekshirib qayta urinib ko‘ring.",
      );
      return;
    }

    if (
      shouldPublish &&
      (!parsedProduct.data.isActive ||
        !parsedProduct.data.variants.some((variant) => variant.stock > 0))
    ) {
      setError(
        "Kanalga chiqarish uchun mahsulot faol va kamida bitta variant stock’i musbat bo‘lishi kerak.",
      );
      return;
    }

    setBusy(true);
    setError(null);
    setSuccess(null);
    setPostUrl(null);
    let productWasSaved = false;

    try {
      const result = await request<ProductMutationResponse>(
        productId
          ? `/api/admin/products/${String(productId)}`
          : "/api/admin/products",
        {
          method: productId ? "PATCH" : "POST",
          idempotent: true,
          body: parsedProduct.data,
        },
      );
      const savedId = result.data.id;
      productWasSaved = true;
      setProductId(savedId);
      const cleanupFailureCount = await cleanupRemovedImages();
      setRemovedImageUrls([]);
      setPersistedImageUrls(product.images.map((image) => image.url));

      if (shouldPublish) {
        const publishResult = await publishProduct(savedId);
        setPostUrl(publishResult.data.postUrl);
        setSuccess(
          publishResult.data.postUrl
            ? "Mahsulot saqlandi va Telegram kanaliga chiqarildi."
            : `Mahsulot saqlandi va kanalga chiqarildi. Message ID: ${String(publishResult.data.telegramMessageId)}`,
        );
      } else {
        setSuccess("Mahsulot muvaffaqiyatli saqlandi.");
      }

      if (cleanupFailureCount > 0) {
        setError(
          "Mahsulot saqlandi, lekin eski rasm fayllaridan ayrimlarini tozalab bo‘lmadi.",
        );
      }

      if (initialProduct?.id === undefined) {
        window.history.replaceState(
          null,
          "",
          `/products/${String(savedId)}/edit`,
        );
      }

      router.refresh();
    } catch (submitError) {
      setError(
        productWasSaved
          ? `Mahsulot saqlandi, lekin kanalga chiqarilmadi: ${getErrorMessage(submitError, "Telegram xatosi yuz berdi.")}`
          : getErrorMessage(submitError, "Mahsulotni saqlab bo‘lmadi."),
      );
    } finally {
      setBusy(false);
    }
  };

  const publish = async (): Promise<void> => {
    if (productId === undefined || busy) {
      return;
    }

    setBusy(true);
    setError(null);
    setSuccess(null);
    setPostUrl(null);

    try {
      const result = await publishProduct(productId);
      setPostUrl(result.data.postUrl);
      setSuccess(
        result.data.postUrl
          ? "Mahsulot Telegram kanaliga chiqarildi."
          : `Post yuborildi. Message ID: ${String(result.data.telegramMessageId)}`,
      );
      router.refresh();
    } catch (publishError) {
      setError(
        getErrorMessage(
          publishError,
          "Mahsulotni kanalga chiqarib bo‘lmadi.",
        ),
      );
    } finally {
      setBusy(false);
    }
  };

  const cancelEditing = async (): Promise<void> => {
    if (busy) {
      return;
    }

    setBusy(true);
    const draftUrls = product.images
      .map((image) => image.url)
      .filter((url) => !persistedImageUrls.includes(url));

    await Promise.allSettled(
      draftUrls.map((url) =>
        request("/api/admin/uploads/product-images", {
          method: "DELETE",
          body: { url },
        }),
      ),
    );
    router.back();
  };

  return (
    <form
      className="editor-form"
      onSubmit={(event) => {
        event.preventDefault();
        void saveProduct(false);
      }}
      ref={formRef}
    >
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <div className="form-success" role="status">
          <span>{success}</span>
          {postUrl ? (
            <a href={postUrl} rel="noreferrer" target="_blank">
              Kanal postini ochish ↗
            </a>
          ) : null}
        </div>
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
              onChange={(event) => {
                const name = event.target.value;
                setProduct((current) => ({
                  ...current,
                  name,
                  ...(slugEdited
                    ? {}
                    : { slug: slugifyProductName(name) }),
                }));
              }}
              required
              value={product.name}
            />
          </label>
          <label>
            Slug
            <input
              maxLength={200}
              onChange={(event) => {
                setSlugEdited(true);
                setProduct({ ...product, slug: event.target.value });
              }}
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
              inputMode="numeric"
              min={0}
              onChange={(event) =>
                { setProduct({
                  ...product,
                  price: event.target.value,
                }); }
              }
              required
              step={1}
              type="number"
              value={product.price}
            />
          </label>
          <label>
            Chegirmali narx
            <input
              inputMode="numeric"
              min={0}
              onChange={(event) =>
                { setProduct({
                  ...product,
                  discountPrice: event.target.value,
                }); }
              }
              step={1}
              type="number"
              value={product.discountPrice}
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
            <span>Telefon galereyasi · 1–8 ta</span>
            <h2>Rasmlar</h2>
          </div>
        </div>
        <ProductImageUploader
          disabled={busy}
          draftId={draftId}
          images={product.images}
          onChange={(updater) => {
            setProduct((current) => ({
              ...current,
              images: updater(current.images),
            }));
          }}
          onUploadingChange={setUploadingImages}
          onPersistedImageRemoved={(url) => {
            setRemovedImageUrls((current) =>
              current.includes(url) ? current : [...current, url],
            );
          }}
          persistedImageUrls={persistedImageUrls}
          {...(productId === undefined ? {} : { productId })}
        />
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
                  { size: "", color: "", stock: "" },
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
                  inputMode="numeric"
                  min={0}
                  onChange={(event) => {
                    const variants = [...product.variants];
                    const current = variants[index];

                    if (current) {
                      variants[index] = {
                        ...current,
                        stock: event.target.value,
                      };
                      setProduct({ ...product, variants });
                    }
                  }}
                  required
                  step={1}
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
      <ProductChannelPreview
        code={product.code}
        description={product.description}
        discountPrice={
          product.discountPrice.length === 0
            ? null
            : getProductIntegerPreview(product.discountPrice)
        }
        name={product.name}
        price={getProductIntegerPreview(product.price)}
        variants={product.variants.map((variant) => ({
          ...variant,
          stock: getProductIntegerPreview(variant.stock),
        }))}
      />
      <div className="form-actions">
        {productId !== undefined ? (
          <button
            className="secondary-button"
            disabled={busy || uploadingImages || !product.isActive}
            onClick={() => {
              void publish();
            }}
            type="button"
          >
            Qayta kanalga chiqarish
          </button>
        ) : null}
        <button
          className="secondary-button"
          disabled={busy || uploadingImages}
          onClick={() => {
            void cancelEditing();
          }}
          type="button"
        >
          Bekor qilish
        </button>
        <button
          className="primary-button"
          disabled={busy || uploadingImages}
          type="submit"
        >
          {busy ? "Saqlanmoqda…" : "Saqlash"}
        </button>
        <button
          className="publish-button"
          disabled={busy || uploadingImages}
          onClick={() => {
            void saveProduct(true);
          }}
          type="button"
        >
          {busy ? "Bajarilmoqda…" : "Saqlash va kanalga chiqarish"}
        </button>
      </div>
    </form>
  );
}
