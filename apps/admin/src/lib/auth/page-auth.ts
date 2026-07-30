import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getAdminServerEnv } from "../env/server";
import {
  ADMIN_SESSION_COOKIE,
  verifyAdminSessionToken,
  type AdminSession,
} from "./session-core";

export async function getAdminPageSession(): Promise<AdminSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;

  return verifyAdminSessionToken(
    token,
    getAdminServerEnv().ADMIN_SESSION_SECRET,
  );
}

export async function requireAdminPageSession(): Promise<AdminSession> {
  const session = await getAdminPageSession();

  if (!session) {
    redirect("/login");
  }

  return session;
}
