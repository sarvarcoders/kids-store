"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type ChangeEvent } from "react";

import { useAdminAuth } from "@/components/auth/admin-auth-provider";
import {
  optimizeProductImage,
  validateSelectedProductImage,
} from "@/lib/storage/image-processing";
import {
  PRODUCT_IMAGE_MAX_COUNT,
  productImageUploadResultSchema,
} from "@/lib/storage/product-image-policy";

export interface EditorProductImage {
  id?: number;
  sortOrder: number;
  url: string;
}

interface UploadItem {
  error?: string;
  id: string;
  name: string;
  progress: number;
  status: "optimizing" | "uploading" | "done" | "error";
}

type ImageUpdater = (
  current: EditorProductImage[],
) => EditorProductImage[];

function normalizeImageOrder(
  images: EditorProductImage[],
): EditorProductImage[] {
  return images.map((image, index) => ({
    ...image,
    sortOrder: index,
  }));
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Rasmni yuklab bo‘lmadi.";
}

export function ProductImageUploader({
  disabled,
  draftId,
  images,
  onChange,
  onUploadingChange,
  onPersistedImageRemoved,
  persistedImageUrls,
  productId,
}: {
  disabled: boolean;
  draftId: string;
  images: EditorProductImage[];
  onChange: (updater: ImageUpdater) => void;
  onUploadingChange: (uploading: boolean) => void;
  onPersistedImageRemoved: (url: string) => void;
  persistedImageUrls: string[];
  productId?: number;
}): React.ReactNode {
  const { request, upload } = useAdminAuth();
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [error, setError] = useState("");
  const [manualUrl, setManualUrl] = useState("");
  const [manualOpen, setManualOpen] = useState(false);
  const isUploading = uploads.some((item) =>
    ["optimizing", "uploading"].includes(item.status),
  );

  useEffect(() => {
    onUploadingChange(isUploading);
  }, [isUploading, onUploadingChange]);

  function updateUpload(id: string, patch: Partial<UploadItem>): void {
    setUploads((current) =>
      current.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    );
  }

  async function uploadFiles(files: File[]): Promise<void> {
    setError("");
    const remaining = PRODUCT_IMAGE_MAX_COUNT - images.length;

    if (files.length > remaining) {
      setError(
        `Ko‘pi bilan yana ${String(remaining)} ta rasm qo‘shish mumkin.`,
      );
      return;
    }

    for (const file of files) {
      const validationError = validateSelectedProductImage(file);

      if (validationError) {
        setError(`${file.name}: ${validationError}`);
        continue;
      }

      const uploadId = crypto.randomUUID();
      setUploads((current) => [
        ...current,
        {
          id: uploadId,
          name: file.name,
          progress: 0,
          status: "optimizing",
        },
      ]);

      try {
        const optimized = await optimizeProductImage(file);
        const formData = new FormData();
        formData.set("file", optimized);
        formData.set("draftId", draftId);

        if (productId !== undefined) {
          formData.set("productId", String(productId));
        }

        updateUpload(uploadId, { progress: 5, status: "uploading" });
        const response = productImageUploadResultSchema.parse(
          await upload<unknown>(
            "/api/admin/uploads/product-images",
            formData,
            (progress) => {
              updateUpload(uploadId, {
                progress: Math.max(5, progress),
              });
            },
          ),
        );

        onChange((current) =>
          normalizeImageOrder([
            ...current,
            {
              url: response.data.url,
              sortOrder: current.length,
            },
          ]),
        );
        updateUpload(uploadId, { progress: 100, status: "done" });
      } catch (uploadError) {
        const message = getErrorMessage(uploadError);
        updateUpload(uploadId, {
          error: message,
          status: "error",
        });
        setError(`${file.name}: ${message}`);
      }
    }
  }

  function handleFiles(event: ChangeEvent<HTMLInputElement>): void {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";

    if (files.length > 0) {
      void uploadFiles(files);
    }
  }

  function moveImage(index: number, direction: -1 | 1): void {
    onChange((current) => {
      const next = [...current];
      const target = index + direction;

      if (target < 0 || target >= next.length) {
        return current;
      }

      const currentImage = next[index];
      const targetImage = next[target];

      if (!currentImage || !targetImage) {
        return current;
      }

      next[index] = targetImage;
      next[target] = currentImage;
      return normalizeImageOrder(next);
    });
  }

  async function removeImage(
    image: EditorProductImage,
    index: number,
  ): Promise<void> {
    setError("");

    if (!persistedImageUrls.includes(image.url)) {
      try {
        await request("/api/admin/uploads/product-images", {
          method: "DELETE",
          body: { url: image.url },
        });
      } catch (deleteError) {
        setError(getErrorMessage(deleteError));
        return;
      }
    } else {
      onPersistedImageRemoved(image.url);
    }

    onChange((current) =>
      normalizeImageOrder(
        current.filter((_, imageIndex) => imageIndex !== index),
      ),
    );
  }

  function addManualUrl(): void {
    setError("");

    try {
      const url = new URL(manualUrl.trim());

      if (url.protocol !== "https:") {
        throw new Error("HTTPS URL kiriting.");
      }

      if (images.some((image) => image.url === url.toString())) {
        throw new Error("Bu rasm allaqachon qo‘shilgan.");
      }

      onChange((current) =>
        normalizeImageOrder([
          ...current,
          { url: url.toString(), sortOrder: current.length },
        ]),
      );
      setManualUrl("");
      setManualOpen(false);
    } catch (manualError) {
      setError(getErrorMessage(manualError));
    }
  }

  return (
    <div className="image-uploader">
      <div className="image-upload-actions">
        <input
          accept="image/*"
          className="visually-hidden"
          disabled={
            disabled ||
            isUploading ||
            images.length >= PRODUCT_IMAGE_MAX_COUNT
          }
          multiple
          onChange={handleFiles}
          ref={galleryInputRef}
          type="file"
        />
        <button
          className="primary-button"
          disabled={
            disabled ||
            isUploading ||
            images.length >= PRODUCT_IMAGE_MAX_COUNT
          }
          onClick={() => galleryInputRef.current?.click()}
          type="button"
        >
          📷 Galereyadan tanlash
        </button>
        <input
          accept="image/*"
          capture="environment"
          className="visually-hidden"
          disabled={
            disabled ||
            isUploading ||
            images.length >= PRODUCT_IMAGE_MAX_COUNT
          }
          onChange={handleFiles}
          ref={cameraInputRef}
          type="file"
        />
        <button
          className="secondary-button"
          disabled={
            disabled ||
            isUploading ||
            images.length >= PRODUCT_IMAGE_MAX_COUNT
          }
          onClick={() => cameraInputRef.current?.click()}
          type="button"
        >
          Kamera
        </button>
      </div>

      <p className="hint">
        {String(images.length)}/{String(PRODUCT_IMAGE_MAX_COUNT)} rasm · JPEG,
        PNG yoki WebP · har biri 12 MB gacha. Rasmlar avtomatik
        kichraytiriladi.
      </p>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      {uploads.length > 0 ? (
        <div aria-live="polite" className="upload-list">
          {uploads.map((item) => (
            <div className="upload-item" key={item.id}>
              <div>
                <strong>{item.name}</strong>
                <small>
                  {item.status === "optimizing"
                    ? "Optimallashtirilmoqda…"
                    : item.status === "uploading"
                      ? `Yuklanmoqda: ${String(item.progress)}%`
                      : item.status === "done"
                        ? "Tayyor"
                        : item.error ?? "Xato"}
                </small>
              </div>
              <progress max={100} value={item.progress} />
            </div>
          ))}
        </div>
      ) : null}

      {images.length > 0 ? (
        <ol className="image-preview-grid">
          {images.map((image, index) => (
            <li key={`${image.url}-${String(index)}`}>
              <div className="image-preview">
                <Image
                  alt={`Mahsulot rasmi ${String(index + 1)}`}
                  fill
                  loading="lazy"
                  sizes="(max-width: 600px) 42vw, 180px"
                  src={image.url}
                />
                {index === 0 ? <span>Asosiy</span> : null}
              </div>
              <div className="image-preview-actions">
                <button
                  aria-label="Rasmni oldinga surish"
                  className="secondary-button"
                  disabled={disabled || index === 0}
                  onClick={() => {
                    moveImage(index, -1);
                  }}
                  type="button"
                >
                  ←
                </button>
                <button
                  aria-label="Rasmni orqaga surish"
                  className="secondary-button"
                  disabled={disabled || index === images.length - 1}
                  onClick={() => {
                    moveImage(index, 1);
                  }}
                  type="button"
                >
                  →
                </button>
                <button
                  className="danger-button"
                  disabled={disabled || images.length === 1}
                  onClick={() => {
                    void removeImage(image, index);
                  }}
                  type="button"
                >
                  O‘chirish
                </button>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <div className="image-empty-state">
          <span>🖼️</span>
          <strong>Kamida bitta rasm yuklang</strong>
          <p>Asosiy rasm kanal posti va katalogda ko‘rinadi.</p>
        </div>
      )}

      <button
        className="text-button"
        onClick={() => {
          setManualOpen((current) => !current);
        }}
        type="button"
      >
        {manualOpen ? "URL kiritishni yopish" : "HTTPS URL orqali qo‘shish"}
      </button>
      {manualOpen ? (
        <div className="manual-image-url">
          <label>
            Rasm URL’i (secondary usul)
            <input
              onChange={(event) => {
                setManualUrl(event.target.value);
              }}
              placeholder="https://…"
              type="url"
              value={manualUrl}
            />
          </label>
          <button
            className="secondary-button"
            disabled={
              disabled ||
              isUploading ||
              manualUrl.trim().length === 0 ||
              images.length >= PRODUCT_IMAGE_MAX_COUNT
            }
            onClick={addManualUrl}
            type="button"
          >
            URL qo‘shish
          </button>
        </div>
      ) : null}
    </div>
  );
}
