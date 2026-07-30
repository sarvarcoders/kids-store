import { adminApiError, noStoreJson } from "@/lib/api/response";
import { getAdminMutationContext } from "@/lib/api/mutation-context";
import { updateAdminCategory } from "@/lib/categories/categories.service";
import { runIdempotentMutation } from "@/lib/security/idempotency";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  try {
    const { session, idempotencyKey } = getAdminMutationContext(
      request,
      { idempotency: true },
    );
    const categoryId = (await context.params).id;
    const body: unknown = await request.json();
    const result = await runIdempotentMutation(
      `category-update:${categoryId}:${session.adminTelegramId}`,
      idempotencyKey ?? "",
      () =>
        updateAdminCategory(
          session.adminTelegramId,
          categoryId,
          body,
        ),
    );

    return noStoreJson({ data: result });
  } catch (error) {
    return adminApiError(error);
  }
}
