import { adminApiError, noStoreJson } from "@/lib/api/response";
import { getAdminMutationContext } from "@/lib/api/mutation-context";
import {
  removeManagedProductImage,
  uploadProductImage,
} from "@/lib/storage/product-image-storage.service";
import {
  productImageDeleteInputSchema,
  productImageUploadMetadataSchema,
} from "@/lib/storage/product-image-policy";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  try {
    await getAdminMutationContext(request);
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return noStoreJson(
        {
          error: {
            code: "IMAGE_REQUIRED",
            message: "Yuklash uchun rasm tanlang.",
          },
        },
        400,
      );
    }

    const productId = formData.get("productId");
    const metadata = productImageUploadMetadataSchema.parse({
      draftId: formData.get("draftId"),
      ...(typeof productId === "string" && productId.length > 0
        ? { productId }
        : {}),
    });
    const uploaded = await uploadProductImage({ file, metadata });

    return noStoreJson({ data: uploaded }, 201);
  } catch (error) {
    return adminApiError(error);
  }
}

export async function DELETE(request: Request): Promise<Response> {
  try {
    await getAdminMutationContext(request);
    const input = productImageDeleteInputSchema.parse(
      (await request.json()) as unknown,
    );
    const deleted = await removeManagedProductImage(input.url);

    return noStoreJson({ data: { deleted } });
  } catch (error) {
    return adminApiError(error);
  }
}
