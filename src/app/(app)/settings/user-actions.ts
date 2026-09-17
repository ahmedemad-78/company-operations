"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { assertSuperAdmin, hashPassword } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { AUDIT_ACTION, ROLE, ROLE_LABEL } from "@/lib/constants";

export type ActionState = { error?: string; success?: string };

const userSchema = z.object({
  name: z.string().trim().min(2, "اسم المستخدم مطلوب"),
  email: z.string().trim().toLowerCase().email("البريد الإلكتروني غير صحيح"),
  password: z.string().min(8, "كلمة المرور لازم تكون 8 حروف على الأقل"),
});

/** إنشاء حساب مدير (View Only) — قرار BRD رقم 19 */
export async function createManager(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await assertSuperAdmin();
    const parsed = userSchema.safeParse({
      name: formData.get("name"),
      email: formData.get("email"),
      password: formData.get("password"),
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
    }

    const existing = await prisma.user.findUnique({
      where: { email: parsed.data.email },
    });
    if (existing) return { error: "البريد الإلكتروني مستخدم بالفعل." };

    const created = await prisma.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        passwordHash: await hashPassword(parsed.data.password),
        role: ROLE.MANAGER,
      },
    });

    await logAudit({
      user,
      action: AUDIT_ACTION.CREATE,
      entity: "User",
      entityId: created.id,
      entityLabel: `${created.name} — ${ROLE_LABEL[created.role]}`,
      after: { name: created.name, email: created.email, role: created.role },
    });

    revalidatePath("/settings");
    return { success: "تم إنشاء حساب المدير" };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "حدث خطأ غير متوقع" };
  }
}

const passwordSchema = z.object({
  id: z.string().min(1),
  password: z.string().min(8, "كلمة المرور لازم تكون 8 حروف على الأقل"),
});

/** إعادة تعيين كلمة مرور أي مستخدم — الحل المعتمد لبند P5 في الـBRD */
export async function resetPassword(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await assertSuperAdmin();
    const parsed = passwordSchema.safeParse({
      id: formData.get("id"),
      password: formData.get("password"),
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
    }

    const target = await prisma.user.findUnique({ where: { id: parsed.data.id } });
    if (!target) return { error: "المستخدم غير موجود" };

    await prisma.user.update({
      where: { id: target.id },
      data: { passwordHash: await hashPassword(parsed.data.password) },
    });

    await logAudit({
      user,
      action: AUDIT_ACTION.UPDATE,
      entity: "User",
      entityId: target.id,
      entityLabel: `إعادة تعيين كلمة مرور ${target.name}`,
      after: { passwordChanged: true },
    });

    revalidatePath("/settings");
    return { success: `تم تغيير كلمة المرور لـ${target.name}` };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "حدث خطأ غير متوقع" };
  }
}

/** إيقاف أو تفعيل حساب مدير — لا يمكن إيقاف المدير الإداري */
export async function toggleUserActive(formData: FormData): Promise<void> {
  const user = await assertSuperAdmin();
  const id = String(formData.get("id") ?? "");
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target || target.role === ROLE.SUPER_ADMIN) return;

  const after = await prisma.user.update({
    where: { id },
    data: { isActive: !target.isActive },
  });

  await logAudit({
    user,
    action: AUDIT_ACTION.UPDATE,
    entity: "User",
    entityId: id,
    entityLabel: `${target.name} — ${after.isActive ? "تفعيل الحساب" : "إيقاف الحساب"}`,
    before: { isActive: target.isActive },
    after: { isActive: after.isActive },
  });

  revalidatePath("/settings");
}
