import { adminOrderStatusInputSchema } from "@kids-store/shared";

import { adminApiError, noStoreJson } from "@/lib/api/response";
import { getAdminMutationContext } from "@/lib/api/mutation-context";
import { authenticateAdminRequest } from "@/lib/auth/request-auth";
import {
  getAdminOrder,
  updateAdminOrderStatus,
} from "@/lib/orders/orders.service";
import { runIdempotentMutation } from "@/lib/security/idempotency";

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
    const order = await getAdminOrder((await context.params).id);
    return order
      ? noStoreJson({ data: order })
      : noStoreJson(
          {
            error: {
              code: "NOT_FOUND",
              message: "Buyurtma topilmadi.",
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
    const { session, idempotencyKey } = getAdminMutationContext(
      request,
      { idempotency: true },
    );
    const orderId = (await context.params).id;
    const body = adminOrderStatusInputSchema.parse(
      await request.json(),
    );
    const result = await runIdempotentMutation(
      `order-status:${orderId}:${session.adminTelegramId}`,
      idempotencyKey ?? "",
      () =>
        updateAdminOrderStatus(
          session.adminTelegramId,
          orderId,
          body.status,
        ),
    );

    return noStoreJson({ data: result });
  } catch (error) {
    return adminApiError(error);
  }
}
