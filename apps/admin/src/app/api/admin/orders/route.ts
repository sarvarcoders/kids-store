import { adminApiError, noStoreJson } from "@/lib/api/response";
import { searchParamsToObject } from "@/lib/api/query";
import { authenticateAdminRequest } from "@/lib/auth/request-auth";
import { listAdminOrders } from "@/lib/orders/orders.service";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    authenticateAdminRequest(request);
    const query = searchParamsToObject(new URL(request.url).searchParams);
    return noStoreJson({ data: await listAdminOrders(query) });
  } catch (error) {
    return adminApiError(error);
  }
}
