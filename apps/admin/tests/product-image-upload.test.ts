import assert from "node:assert/strict";
import test from "node:test";

import { adminProductInputSchema } from "@kids-store/shared";

import { validateSelectedProductImage } from "../src/lib/storage/image-processing.js";
import {
  PRODUCT_IMAGE_MAX_SOURCE_BYTES,
  buildProductImageStoragePath,
  detectProductImageMimeType,
  getManagedProductImagePath,
  isAllowedProductImageUrl,
  isLegacyProductImageUrl,
} from "../src/lib/storage/product-image-policy.js";

const supabaseUrl = "https://example-project.supabase.co";
const bucket = "product-images";
const uploadedUrl =
  `${supabaseUrl}/storage/v1/object/public/${bucket}/` +
  "products/temp/26cdb523-e5ae-4a2b-8324-5aa9bc9e49ed/1-testimage.webp";
const validProduct = {
  code: "KS-UPLOAD-1",
  name: "Yuklangan rasmli kostyum",
  slug: "yuklangan-rasmli-kostyum",
  description: "Test mahsuloti",
  categoryId: 1,
  price: 249_000,
  discountPrice: null,
  isActive: true,
  images: [{ url: uploadedUrl, sortOrder: 0 }],
  variants: [{ size: "104", color: "Ko‘k", stock: 3 }],
};

void test("gallery fayl turi va hajmini clientda tekshiradi", () => {
  assert.equal(
    validateSelectedProductImage({
      type: "image/jpeg",
      size: 2_000_000,
    }),
    null,
  );
  assert.match(
    validateSelectedProductImage({
      type: "image/svg+xml",
      size: 1_000,
    }) ?? "",
    /JPEG, PNG yoki WebP/,
  );
  assert.match(
    validateSelectedProductImage({
      type: "image/webp",
      size: PRODUCT_IMAGE_MAX_SOURCE_BYTES + 1,
    }) ?? "",
    /50 MB/,
  );
});

void test("server magic bytes orqali JPEG, PNG va WebPni aniqlaydi", () => {
  assert.equal(
    detectProductImageMimeType(
      Uint8Array.from([0xff, 0xd8, 0xff, 0x00]),
    ),
    "image/jpeg",
  );
  assert.equal(
    detectProductImageMimeType(
      Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10]),
    ),
    "image/png",
  );
  assert.equal(
    detectProductImageMimeType(
      Uint8Array.from([
        0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42,
        0x50,
      ]),
    ),
    "image/webp",
  );
  assert.equal(detectProductImageMimeType(Uint8Array.from([1, 2, 3])), null);
});

void test("storage path temp va product papkalari uchun deterministic formatda", () => {
  assert.equal(
    buildProductImageStoragePath({
      draftId: "26cdb523-e5ae-4a2b-8324-5aa9bc9e49ed",
      extension: "webp",
      now: 123,
      randomId: "abcdefgh",
    }),
    "products/temp/26cdb523-e5ae-4a2b-8324-5aa9bc9e49ed/123-abcdefgh.webp",
  );
  assert.equal(
    buildProductImageStoragePath({
      draftId: "26cdb523-e5ae-4a2b-8324-5aa9bc9e49ed",
      extension: "jpg",
      now: 456,
      productId: 17,
      randomId: "ijklmnop",
    }),
    "products/17/456-ijklmnop.jpg",
  );
});

void test("faqat shu Supabase loyiha bucketidagi URL managed hisoblanadi", () => {
  assert.equal(
    getManagedProductImagePath({ publicUrl: uploadedUrl, supabaseUrl, bucket }),
    "products/temp/26cdb523-e5ae-4a2b-8324-5aa9bc9e49ed/1-testimage.webp",
  );
  assert.equal(
    getManagedProductImagePath({
      publicUrl: uploadedUrl.replace("example-project", "attacker"),
      supabaseUrl,
      bucket,
    }),
    null,
  );
  assert.equal(
    isAllowedProductImageUrl({
      publicUrl: "https://attacker.example/image.webp",
      supabaseUrl,
      bucket,
    }),
    false,
  );
  assert.equal(
    isLegacyProductImageUrl("https://placehold.co/800x1000"),
    true,
  );
  assert.equal(
    isLegacyProductImageUrl("https://placehold.co:444/800x1000"),
    false,
  );
});

void test("create va edit input uploaded rasm bilan ishlaydi", () => {
  const created = adminProductInputSchema.parse(validProduct);
  const edited = adminProductInputSchema.parse({
    ...validProduct,
    name: "Yangilangan mahsulot",
    images: [
      { id: 5, url: uploadedUrl, sortOrder: 0 },
      {
        url: "https://placehold.co/800x1000",
        sortOrder: 1,
      },
    ],
  });

  assert.equal(created.images.length, 1);
  assert.equal(edited.images[0]?.id, 5);
  assert.equal(edited.images.length, 2);
  assert.equal(
    adminProductInputSchema.safeParse({ ...validProduct, images: [] }).success,
    false,
  );
  assert.equal(
    adminProductInputSchema.safeParse({
      ...validProduct,
      images: Array.from({ length: 9 }, (_, sortOrder) => ({
        url: `${uploadedUrl}?image=${String(sortOrder)}`,
        sortOrder,
      })),
    }).success,
    false,
  );
});
