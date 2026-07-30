import { adminApiError, noStoreJson } from "@/lib/api/response";
import { authenticateAdminRequest } from "@/lib/auth/request-auth";
import { getAdminCustomer } from "@/lib/customers/customers.service";

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
    const customer = await getAdminCustomer((await context.params).id);
    return customer
      ? noStoreJson({ data: customer })
      : noStoreJson(
          {
            error: {
              code: "NOT_FOUND",
              message: "Mijoz topilmadi.",
            },
          },
          404,
        );
  } catch (error) {
    return adminApiError(error);
  }
}
