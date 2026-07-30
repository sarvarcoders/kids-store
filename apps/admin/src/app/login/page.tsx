import { redirect } from "next/navigation";

import { LoginPanel } from "@/components/auth/login-panel";
import { getAdminPageSession } from "@/lib/auth/page-auth";

export const dynamic = "force-dynamic";

export default async function LoginPage(): Promise<React.ReactNode> {
  const session = await getAdminPageSession();

  if (session) {
    redirect("/dashboard");
  }

  return (
    <main className="login-page">
      <LoginPanel />
    </main>
  );
}
