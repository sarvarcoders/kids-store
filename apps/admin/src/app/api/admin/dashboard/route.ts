import { adminApiError, noStoreJson } from "@/lib/api/response";
import { authenticateAdminRequest } from "@/lib/auth/request-auth";
import { getAdminDashboard } from "@/lib/dashboard/dashboard.service";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    authenticateAdminRequest(request);
    return noStoreJson({ data: await getAdminDashboard() });
  } catch (error) {
    return adminApiError(error);
  }
}
