import "server-only";

import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/auth";

type AuditInput = {
  user: SessionUser | null;
  action: string;
  entity: string;
  entityId?: string | null;
  entityLabel?: string | null;
  before?: unknown;
  after?: unknown;
};

function serialize(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  return JSON.stringify(value, (_key, val) =>
    val instanceof Date ? val.toISOString() : val,
  );
}

/**
 * الـAudit Log يسجل كل شيء: إضافة، تعديل، إلغاء، دخول، فتح إقفال (قرار BRD رقم 24).
 * لا يُفشل العملية الأساسية لو فشل التسجيل، لكن يسجل الخطأ في الكونسول.
 *
 * الاستثناء الوحيد: حساب صاحب المشروع المخفي — عملياته لا تُسجَّل (قرار BRD رقم 38).
 */
export async function logAudit({
  user,
  action,
  entity,
  entityId,
  entityLabel,
  before,
  after,
}: AuditInput): Promise<void> {
  if (user?.hidden) return;

  try {
    await prisma.auditLog.create({
      data: {
        userId: user?.id ?? null,
        userName: user?.name ?? "غير معروف",
        action,
        entity,
        entityId: entityId ?? null,
        entityLabel: entityLabel ?? null,
        beforeJson: serialize(before),
        afterJson: serialize(after),
      },
    });
  } catch (error) {
    console.error("فشل تسجيل Audit Log:", error);
  }
}
