import "server-only";

import { randomUUID } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getProductImageStorageEnv } from "../env/server";
import { AdminServiceError } from "../errors/admin-service-error";
import {
  PRODUCT_IMAGE_ALLOWED_MIME_TYPES,
  PRODUCT_IMAGE_MAX_UPLOAD_BYTES,
  buildProductImageStoragePath,
  detectProductImageMimeType,
  extensionForProductImageMime,
  getManagedProductImagePath,
  isLegacyProductImageUrl,
  productImageUploadMetadataSchema,
} from "./product-image-policy";

let storageClient: SupabaseClient | undefined;
let bucketReady = false;

function getStorageEnv() {
  try {
    return getProductImageStorageEnv();
  } catch (error) {
    throw new AdminServiceError(
      "STORAGE_NOT_CONFIGURED",
      "Rasm ombori sozlanmagan. Administratorga murojaat qiling.",
      409,
      error,
    );
  }
}

function getStorageClient(): SupabaseClient {
  const env = getStorageEnv();

  storageClient ??= createClient(
    env.SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );

  return storageClient;
}

async function ensureProductImageBucket(): Promise<void> {
  if (bucketReady) {
    return;
  }

  const env = getStorageEnv();
  const client = getStorageClient();
  const current = await client.storage.getBucket(
    env.SUPABASE_STORAGE_BUCKET,
  );

  if (current.data) {
    if (!current.data.public) {
      throw new AdminServiceError(
        "STORAGE_BUCKET_PRIVATE",
        "Mahsulot rasmlari bucket’i public bo‘lishi kerak.",
        409,
      );
    }

    bucketReady = true;
    return;
  }

  if (current.error.status !== 404) {
    throw new AdminServiceError(
      "STORAGE_UNAVAILABLE",
      "Rasm omboriga ulanishda xato yuz berdi.",
      409,
      current.error,
    );
  }

  const created = await client.storage.createBucket(
    env.SUPABASE_STORAGE_BUCKET,
    {
      public: true,
      allowedMimeTypes: [...PRODUCT_IMAGE_ALLOWED_MIME_TYPES],
      fileSizeLimit: PRODUCT_IMAGE_MAX_UPLOAD_BYTES,
    },
  );

  if (created.error) {
    const raced = await client.storage.getBucket(
      env.SUPABASE_STORAGE_BUCKET,
    );

    if (!raced.data?.public) {
      throw new AdminServiceError(
        "STORAGE_BUCKET_CREATE_FAILED",
        "Rasm omborini tayyorlab bo‘lmadi.",
        409,
        created.error,
      );
    }
  }

  bucketReady = true;
}

export async function uploadProductImage(input: {
  file: File;
  metadata: unknown;
}): Promise<{ path: string; url: string }> {
  const metadata = productImageUploadMetadataSchema.parse(input.metadata);

  if (
    !PRODUCT_IMAGE_ALLOWED_MIME_TYPES.includes(
      input.file.type as (typeof PRODUCT_IMAGE_ALLOWED_MIME_TYPES)[number],
    )
  ) {
    throw new AdminServiceError(
      "IMAGE_TYPE_NOT_ALLOWED",
      "Faqat JPEG, PNG yoki WebP rasm yuklash mumkin.",
      409,
    );
  }

  if (
    input.file.size <= 0 ||
    input.file.size > PRODUCT_IMAGE_MAX_UPLOAD_BYTES
  ) {
    throw new AdminServiceError(
      "IMAGE_SIZE_NOT_ALLOWED",
      "Optimallashtirilgan rasm 3 MB dan oshmasligi kerak.",
      409,
    );
  }

  const bytes = new Uint8Array(await input.file.arrayBuffer());
  const detectedMimeType = detectProductImageMimeType(bytes);

  if (!detectedMimeType || detectedMimeType !== input.file.type) {
    throw new AdminServiceError(
      "IMAGE_CONTENT_INVALID",
      "Fayl tarkibi rasm formatiga mos emas.",
      409,
    );
  }

  await ensureProductImageBucket();

  const env = getStorageEnv();
  const path = buildProductImageStoragePath({
    draftId: metadata.draftId,
    ...(metadata.productId === undefined
      ? {}
      : { productId: metadata.productId }),
    extension: extensionForProductImageMime(detectedMimeType),
    now: Date.now(),
    randomId: randomUUID().replaceAll("-", ""),
  });
  const bucket = getStorageClient().storage.from(
    env.SUPABASE_STORAGE_BUCKET,
  );
  const uploaded = await bucket.upload(path, bytes, {
    cacheControl: "31536000",
    contentType: detectedMimeType,
    upsert: false,
  });

  if (uploaded.error) {
    throw new AdminServiceError(
      "IMAGE_UPLOAD_FAILED",
      "Rasmni yuklab bo‘lmadi. Qayta urinib ko‘ring.",
      409,
      uploaded.error,
    );
  }

  const { data } = bucket.getPublicUrl(uploaded.data.path);

  return {
    path: uploaded.data.path,
    url: data.publicUrl,
  };
}

export async function removeManagedProductImage(
  publicUrl: unknown,
): Promise<boolean> {
  if (
    typeof publicUrl !== "string" ||
    isLegacyProductImageUrl(publicUrl)
  ) {
    return false;
  }

  const env = getStorageEnv();
  const path = getManagedProductImagePath({
    publicUrl,
    supabaseUrl: env.SUPABASE_URL,
    bucket: env.SUPABASE_STORAGE_BUCKET,
  });

  if (!path) {
    return false;
  }

  const removed = await getStorageClient()
    .storage.from(env.SUPABASE_STORAGE_BUCKET)
    .remove([path]);

  if (removed.error) {
    throw new AdminServiceError(
      "IMAGE_DELETE_FAILED",
      "Rasmni ombordan o‘chirib bo‘lmadi.",
      409,
      removed.error,
    );
  }

  return true;
}

export function resetProductImageStorageForTests(): void {
  if (process.env.NODE_ENV === "test") {
    storageClient = undefined;
    bucketReady = false;
  }
}
