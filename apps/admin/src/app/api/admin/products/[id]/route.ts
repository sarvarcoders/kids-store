import { adminApiError, noStoreJson } from "@/lib/api/response";
import { getAdminMutationContext } from "@/lib/api/mutation-context";
import { authenticateAdminRequest } from "@/lib/auth/request-auth";
import {
  getAdminProduct,
  updateAdminProduct,
} from "@/lib/products/products.service";
import { runIdempotentMutation } from "@/lib/security/idempotency";
import { revalidateCatalogAfterMutation } from "@/lib/catalog/revalidation";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  try {
    authenticateAdminRequest(request);
    const product = await getAdminProduct((await context.params).id);

    return product
      ? noStoreJson({ data: product })
      : noStoreJson(
          {
            error: {
              code: "NOT_FOUND",
              message: "Mahsulot topilmadi.",
            },
          },
          404,
        );
  } catch (error) {
    return adminApiError(error);
  }
}

export async function PATCH(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  try {
    const { session, idempotencyKey } = await getAdminMutationContext(
      request,
      { idempotency: true },
    );
    const productId = (await context.params).id;
    const body: unknown = await request.json();
    const result = await runIdempotentMutation(
      `product-update:${productId}:${session.adminTelegramId}`,
      idempotencyKey ?? "",
      () =>
        updateAdminProduct(
          session.adminTelegramId,
          productId,
          body,
        ),
    );
    await revalidateCatalogAfterMutation();

    return noStoreJson({ data: result });
  } catch (error) {
    return adminApiError(error);
  }
}
