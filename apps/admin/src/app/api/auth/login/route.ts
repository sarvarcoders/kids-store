import { adminLoginInputSchema } from "@kids-store/shared";

import { appendAdminAuditLog } from "@/lib/audit/audit.service";
import {
  AdminLoginError,
  validateAdminTelegramLogin,
} from "@/lib/auth/admin-login";
import {
  createAdminSessionToken,
  ADMIN_SESSION_COOKIE,
} from "@/lib/auth/session-core";
import { adminApiError, noStoreJson } from "@/lib/api/response";
import { getAdminServerEnv } from "@/lib/env/server";
import { assertRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  try {
    const forwardedFor =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown";
    assertRateLimit({
      key: `admin-login:${forwardedFor}`,
      limit: 10,
      windowMs: 60_000,
    });
    const input = adminLoginInputSchema.parse(await request.json());
    const env = getAdminServerEnv();
    const identity = validateAdminTelegramLogin({
      initData: input.initData,
      botToken: env.TELEGRAM_BOT_TOKEN,
      allowedIds: env.ADMIN_TELEGRAM_IDS,
    });
    const { session, token } = createAdminSessionToken(
      identity,
      env.ADMIN_SESSION_SECRET,
    );
    await appendAdminAuditLog({
      adminTelegramId: identity.adminTelegramId,
      action: "admin_logged_in",
      entityType: "AdminSession",
      entityId: identity.adminTelegramId,
      metadata: {},
    });
    const response = noStoreJson({
      data: {
        admin: {
          telegramId: session.adminTelegramId,
          firstName: session.firstName,
          ...(session.username
            ? { username: session.username }
            : {}),
        },
        csrfToken: session.csrfToken,
      },
    });

    response.cookies.set({
      name: ADMIN_SESSION_COOKIE,
      value: token,
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: session.expiresAt - session.issuedAt,
    });

    return response;
  } catch (error) {
    if (error instanceof AdminLoginError) {
      console.info(
        JSON.stringify({
          event: "admin_telegram_auth",
          reasonCode: error.code,
        }),
      );
      return noStoreJson(
        {
          error: {
            code: error.code,
            message: error.message,
          },
        },
        error.code === "FORBIDDEN" ? 403 : 401,
      );
    }

    if (
      error instanceof Error &&
      error.message === "RATE_LIMIT_EXCEEDED"
    ) {
      return noStoreJson(
        {
          error: {
            code: "RATE_LIMITED",
            message: "Juda ko‘p urinish. Birozdan keyin qayta urinib ko‘ring.",
          },
        },
        429,
      );
    }

    return adminApiError(error);
  }
}
