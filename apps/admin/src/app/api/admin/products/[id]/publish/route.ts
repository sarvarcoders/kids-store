import { adminApiError, noStoreJson } from "@/lib/api/response";
import { getAdminMutationContext } from "@/lib/api/mutation-context";
import { publishAdminProduct } from "@/lib/channel/channel-posts.service";
import { runIdempotentMutation } from "@/lib/security/idempotency";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  try {
    const { session, idempotencyKey } = getAdminMutationContext(
      request,
      { idempotency: true },
    );
    const productId = (await context.params).id;
    const result = await runIdempotentMutation(
      `product-publish:${productId}:${session.adminTelegramId}`,
      idempotencyKey ?? "",
      () => publishAdminProduct(session.adminTelegramId, productId),
    );

    return noStoreJson({ data: result });
  } catch (error) {
    return adminApiError(error);
  }
}
