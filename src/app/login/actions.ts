"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { createSession, verifyPassword } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { AUDIT_ACTION } from "@/lib/constants";

const schema = z.object({
  email: z.string().trim().min(1, "من فضلك اكتب البريد الإلكتروني"),
  password: z.string().min(1, "من فضلك اكتب كلمة المرور"),
});

export type LoginState = { error?: string };

export async function login(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
  }

  const email = parsed.data.email.toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !user.isActive) {
    return { error: "بيانات الدخول غير صحيحة" };
  }

  const valid = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!valid) {
    return { error: "بيانات الدخول غير صحيحة" };
  }

  await createSession(user.id);
  await logAudit({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      hidden: user.hidden,
    },
    action: AUDIT_ACTION.LOGIN,
    entity: "Session",
    entityLabel: `دخول ${user.name}`,
  });

  redirect("/");
}
