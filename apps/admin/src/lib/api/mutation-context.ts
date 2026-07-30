import "server-only";

import { authenticateAdminRequest } from "../auth/request-auth";
import { assertRateLimit } from "../security/rate-limit";

export function getAdminMutationContext(
  request: Request,
  options: {
    idempotency?: boolean;
  } = {},
) {
  const context = authenticateAdminRequest(request, {
    csrf: true,
    ...(options.idempotency === undefined
      ? {}
      : { idempotency: options.idempotency }),
  });
  const pathname = new URL(request.url).pathname;

  assertRateLimit({
    key: `admin-mutation:${context.session.adminTelegramId}:${pathname}`,
    limit: 30,
    windowMs: 60_000,
  });

  return context;
}
