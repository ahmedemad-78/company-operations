"use server";

import { redirect } from "next/navigation";

import { destroySession, getCurrentUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { AUDIT_ACTION } from "@/lib/constants";

export async function logout(): Promise<void> {
  const user = await getCurrentUser();
  if (user) {
    await logAudit({
      user,
      action: AUDIT_ACTION.LOGOUT,
      entity: "Session",
      entityLabel: `خروج ${user.name}`,
    });
  }
  await destroySession();
  redirect("/login");
}
