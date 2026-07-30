import type { ReactNode } from "react";

import { AdminAuthProvider } from "@/components/auth/admin-auth-provider";
import { AdminShell } from "@/components/layout/admin-shell";
import { requireAdminPageSession } from "@/lib/auth/page-auth";

export const dynamic = "force-dynamic";

export default async function ProtectedLayout({
  children,
}: {
  children: ReactNode;
}): Promise<React.ReactNode> {
  const session = await requireAdminPageSession();
  const admin = {
    telegramId: session.adminTelegramId,
    firstName: session.firstName,
    ...(session.username ? { username: session.username } : {}),
  };

  return (
    <AdminAuthProvider initialAdmin={admin}>
      <AdminShell>{children}</AdminShell>
    </AdminAuthProvider>
  );
}
