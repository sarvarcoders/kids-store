import { appendAdminAuditLog } from "@/lib/audit/audit.service";
import { adminApiError, noStoreJson } from "@/lib/api/response";
import { authenticateAdminRequest } from "@/lib/auth/request-auth";
import {
  ADMIN_SESSION_COOKIE,
  getAdminSessionCookiePolicy,
} from "@/lib/auth/session-core";
import { getAdminServerEnv } from "@/lib/env/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  try {
    const { session } = authenticateAdminRequest(request, {
      csrf: true,
    });
    try {
      await appendAdminAuditLog({
        adminTelegramId: session.adminTelegramId,
        action: "admin_logged_out",
        entityType: "AdminSession",
        entityId: session.adminTelegramId,
        metadata: {},
      });
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "admin_logout_audit_failed",
          errorName:
            error instanceof Error ? error.name : "UnknownError",
        }),
      );
    }
    const response = noStoreJson({ data: { loggedOut: true } });

    const env = getAdminServerEnv();
    response.cookies.set({
      name: ADMIN_SESSION_COOKIE,
      value: "",
      ...getAdminSessionCookiePolicy(env.NODE_ENV),
      maxAge: 0,
    });

    return response;
  } catch (error) {
    return adminApiError(error);
  }
}
