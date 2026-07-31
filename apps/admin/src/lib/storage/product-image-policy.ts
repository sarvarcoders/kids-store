import { z } from "zod";

export const PRODUCT_IMAGE_BUCKET_DEFAULT = "product-images";
export const PRODUCT_IMAGE_MAX_COUNT = 8;
export const PRODUCT_IMAGE_MAX_SOURCE_BYTES = 12 * 1024 * 1024;
export const PRODUCT_IMAGE_MAX_UPLOAD_BYTES = 3 * 1024 * 1024;
export const PRODUCT_IMAGE_ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

const bucketSchema = z
  .string()
  .trim()
  .min(3)
  .max(63)
  .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/);
const draftIdSchema = z.uuid();
const productIdSchema = z.coerce.number().int().positive();
const httpsUrlSchema = z
  .url()
  .max(2_048)
  .refine((value) => value.startsWith("https://"));

export const productImageUploadMetadataSchema = z
  .object({
    draftId: draftIdSchema,
    productId: productIdSchema.optional(),
  })
  .strict();

export const productImageDeleteInputSchema = z
  .object({
    url: httpsUrlSchema,
  })
  .strict();

export const productImageUploadResultSchema = z
  .object({
    data: z.object({
      url: httpsUrlSchema,
      path: z.string().min(1).max(500),
    }),
  })
  .strict();

export type ProductImageUploadResult = z.infer<
  typeof productImageUploadResultSchema
>;

export function parseProductImageBucket(value: unknown): string {
  return bucketSchema.parse(value ?? PRODUCT_IMAGE_BUCKET_DEFAULT);
}

export function detectProductImageMimeType(
  bytes: Uint8Array,
): (typeof PRODUCT_IMAGE_ALLOWED_MIME_TYPES)[number] | null {
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return "image/jpeg";
  }

  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }

  if (
    bytes.length >= 12 &&
    new TextDecoder("ascii").decode(bytes.slice(0, 4)) === "RIFF" &&
    new TextDecoder("ascii").decode(bytes.slice(8, 12)) === "WEBP"
  ) {
    return "image/webp";
  }

  return null;
}

export function extensionForProductImageMime(
  mimeType: (typeof PRODUCT_IMAGE_ALLOWED_MIME_TYPES)[number],
): "jpg" | "png" | "webp" {
  switch (mimeType) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    default:
      return "webp";
  }
}

export function buildProductImageStoragePath(input: {
  draftId: string;
  extension: "jpg" | "png" | "webp";
  now: number;
  productId?: number;
  randomId: string;
}): string {
  const metadata = productImageUploadMetadataSchema.parse({
    draftId: input.draftId,
    ...(input.productId === undefined
      ? {}
      : { productId: input.productId }),
  });
  const randomId = z
    .string()
    .regex(/^[A-Za-z0-9_-]{8,100}$/)
    .parse(input.randomId);
  const now = z.number().int().nonnegative().parse(input.now);
  const folder = metadata.productId
    ? String(metadata.productId)
    : `temp/${metadata.draftId}`;

  return `products/${folder}/${String(now)}-${randomId}.${input.extension}`;
}

export function getManagedProductImagePath(input: {
  bucket: string;
  publicUrl: string;
  supabaseUrl: string;
}): string | null {
  const bucket = parseProductImageBucket(input.bucket);

  try {
    const publicUrl = new URL(input.publicUrl);
    const supabaseUrl = new URL(input.supabaseUrl);
    const prefix = `/storage/v1/object/public/${bucket}/`;

    if (
      publicUrl.protocol !== "https:" ||
      supabaseUrl.protocol !== "https:" ||
      publicUrl.origin !== supabaseUrl.origin ||
      !publicUrl.pathname.startsWith(prefix)
    ) {
      return null;
    }

    const encodedPath = publicUrl.pathname.slice(prefix.length);
    const path = encodedPath
      .split("/")
      .map((part) => decodeURIComponent(part))
      .join("/");

    return path.startsWith("products/") && !path.includes("..")
      ? path
      : null;
  } catch {
    return null;
  }
}

export function isAllowedProductImageUrl(input: {
  bucket: string;
  publicUrl: string;
  supabaseUrl: string;
}): boolean {
  if (isLegacyProductImageUrl(input.publicUrl)) {
    return true;
  }

  return getManagedProductImagePath(input) !== null;
}

export function isLegacyProductImageUrl(publicUrl: string): boolean {
  try {
    const url = new URL(publicUrl);

    return (
      url.protocol === "https:" &&
      (url.port === "" || url.port === "443") &&
      ["placehold.co", "images.unsplash.com"].includes(url.hostname)
    );
  } catch {
    return false;
  }
}
