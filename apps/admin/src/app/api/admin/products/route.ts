import { adminApiError, noStoreJson } from "@/lib/api/response";
import { getAdminMutationContext } from "@/lib/api/mutation-context";
import { searchParamsToObject } from "@/lib/api/query";
import { authenticateAdminRequest } from "@/lib/auth/request-auth";
import {
  createAdminProduct,
  listAdminProducts,
} from "@/lib/products/products.service";
import { runIdempotentMutation } from "@/lib/security/idempotency";
import { revalidateCatalogAfterMutation } from "@/lib/catalog/revalidation";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    authenticateAdminRequest(request);
    const query = searchParamsToObject(new URL(request.url).searchParams);
    return noStoreJson({ data: await listAdminProducts(query) });
  } catch (error) {
    return adminApiError(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const { session, idempotencyKey } = await getAdminMutationContext(
      request,
      { idempotency: true },
    );
    const body: unknown = await request.json();
    const product = await runIdempotentMutation(
      `product-create:${session.adminTelegramId}`,
      idempotencyKey ?? "",
      () => createAdminProduct(session.adminTelegramId, body),
    );
    await revalidateCatalogAfterMutation();

    return noStoreJson({ data: product }, 201);
  } catch (error) {
    return adminApiError(error);
  }
}
