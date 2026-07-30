import { adminApiError, noStoreJson } from "@/lib/api/response";
import { getAdminMutationContext } from "@/lib/api/mutation-context";
import { authenticateAdminRequest } from "@/lib/auth/request-auth";
import {
  createAdminCategory,
  listAdminCategories,
} from "@/lib/categories/categories.service";
import { runIdempotentMutation } from "@/lib/security/idempotency";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    authenticateAdminRequest(request);
    return noStoreJson({ data: await listAdminCategories() });
  } catch (error) {
    return adminApiError(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const { session, idempotencyKey } = getAdminMutationContext(
      request,
      { idempotency: true },
    );
    const body: unknown = await request.json();
    const result = await runIdempotentMutation(
      `category-create:${session.adminTelegramId}`,
      idempotencyKey ?? "",
      () => createAdminCategory(session.adminTelegramId, body),
    );

    return noStoreJson({ data: result }, 201);
  } catch (error) {
    return adminApiError(error);
  }
}
