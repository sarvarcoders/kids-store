import { z } from "zod";

import { adminApiError, noStoreJson } from "@/lib/api/response";
import { getAdminMutationContext } from "@/lib/api/mutation-context";
import { setAdminProductActive } from "@/lib/products/products.service";
import { runIdempotentMutation } from "@/lib/security/idempotency";
import { revalidateCatalogAfterMutation } from "@/lib/catalog/revalidation";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
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
    const body = z
      .object({
        isActive: z.boolean(),
      })
      .parse(await request.json());
    const result = await runIdempotentMutation(
      `product-active:${productId}:${session.adminTelegramId}`,
      idempotencyKey ?? "",
      () =>
        setAdminProductActive(
          session.adminTelegramId,
          productId,
          body.isActive,
        ),
    );
    await revalidateCatalogAfterMutation();

    return noStoreJson({ data: result });
  } catch (error) {
    return adminApiError(error);
  }
}
