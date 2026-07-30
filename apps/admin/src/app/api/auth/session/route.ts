import { adminApiError, noStoreJson } from "@/lib/api/response";
import { authenticateAdminRequest } from "@/lib/auth/request-auth";

export const dynamic = "force-dynamic";

export function GET(request: Request): Response {
  try {
    const { session } = authenticateAdminRequest(request);

    return noStoreJson({
      data: {
        admin: {
          telegramId: session.adminTelegramId,
          firstName: session.firstName,
          ...(session.username
            ? { username: session.username }
            : {}),
        },
        csrfToken: session.csrfToken,
        expiresAt: new Date(session.expiresAt * 1_000).toISOString(),
      },
    });
  } catch (error) {
    return adminApiError(error);
  }
}
