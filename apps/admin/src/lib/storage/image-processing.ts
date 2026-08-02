import {
  PRODUCT_IMAGE_ALLOWED_MIME_TYPES,
  PRODUCT_IMAGE_MAX_SOURCE_BYTES,
  PRODUCT_IMAGE_MAX_SOURCE_MEGABYTES,
  PRODUCT_IMAGE_MAX_UPLOAD_BYTES,
} from "./product-image-policy";

export const PRODUCT_IMAGE_MAX_DIMENSION = 1_600;

export interface ProductImageFileMetadata {
  size: number;
  type: string;
}

export function validateSelectedProductImage(
  file: ProductImageFileMetadata,
): string | null {
  if (
    !PRODUCT_IMAGE_ALLOWED_MIME_TYPES.includes(
      file.type as (typeof PRODUCT_IMAGE_ALLOWED_MIME_TYPES)[number],
    )
  ) {
    return "Faqat JPEG, PNG yoki WebP rasm tanlang.";
  }

  if (file.size <= 0) {
    return "Bo‘sh faylni yuklab bo‘lmaydi.";
  }

  if (file.size > PRODUCT_IMAGE_MAX_SOURCE_BYTES) {
    return `Asl rasm hajmi ${String(PRODUCT_IMAGE_MAX_SOURCE_MEGABYTES)} MB dan oshmasligi kerak.`;
  }

  return null;
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: "image/jpeg" | "image/webp",
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, type, quality);
  });
}

async function loadImageSource(file: File): Promise<{
  dispose: () => void;
  height: number;
  source: CanvasImageSource;
  width: number;
}> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file, {
      imageOrientation: "from-image",
    });

    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      dispose: () => {
        bitmap.close();
      },
    };
  }

  const objectUrl = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = "async";
  image.src = objectUrl;

  try {
    await image.decode();
  } catch {
    URL.revokeObjectURL(objectUrl);
    throw new Error("Rasmni brauzerda o‘qib bo‘lmadi.");
  }

  return {
    source: image,
    width: image.naturalWidth,
    height: image.naturalHeight,
    dispose: () => {
      URL.revokeObjectURL(objectUrl);
    },
  };
}

export async function optimizeProductImage(file: File): Promise<File> {
  const validationError = validateSelectedProductImage(file);

  if (validationError) {
    throw new Error(validationError);
  }

  const loaded = await loadImageSource(file);

  try {
    if (loaded.width <= 0 || loaded.height <= 0) {
      throw new Error("Rasm o‘lchami noto‘g‘ri.");
    }

    const scale = Math.min(
      1,
      PRODUCT_IMAGE_MAX_DIMENSION / Math.max(loaded.width, loaded.height),
    );
    const width = Math.max(1, Math.round(loaded.width * scale));
    const height = Math.max(1, Math.round(loaded.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: false });

    if (!context) {
      throw new Error("Rasmni optimallashtirish qo‘llab-quvvatlanmadi.");
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(loaded.source, 0, 0, width, height);

    const firstPass = await canvasToBlob(canvas, "image/webp", 0.82);
    const secondPass =
      firstPass && firstPass.size <= PRODUCT_IMAGE_MAX_UPLOAD_BYTES
        ? firstPass
        : await canvasToBlob(canvas, "image/webp", 0.66);
    const optimized =
      secondPass?.type === "image/webp" &&
      secondPass.size <= PRODUCT_IMAGE_MAX_UPLOAD_BYTES
        ? secondPass
        : await canvasToBlob(canvas, "image/jpeg", 0.78);

    if (!optimized || optimized.size > PRODUCT_IMAGE_MAX_UPLOAD_BYTES) {
      throw new Error(
        "Rasm optimallashtirilgandan keyin ham 3 MB dan katta.",
      );
    }

    const extension = optimized.type === "image/webp" ? "webp" : "jpg";

    return new File(
      [optimized],
      `product-${String(Date.now())}.${extension}`,
      { type: optimized.type },
    );
  } finally {
    loaded.dispose();
  }
}
