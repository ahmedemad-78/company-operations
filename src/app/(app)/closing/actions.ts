"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { assertSuperAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { dayFigures, oldestUnclosedDayBefore } from "@/lib/cash";
import { AUDIT_ACTION, CLOSING_STATUS } from "@/lib/constants";
import { formatDate, formatMoney, startOfDay } from "@/lib/format";
import { getSystemStartDate } from "@/lib/settings";

export type ActionState = { error?: string; success?: string };

const closeSchema = z.object({
  date: z.string().min(1, "التاريخ مطلوب"),
  actualCash: z.coerce
    .number({ message: "الرصيد الفعلي غير صحيح" })
    .int("المبلغ لازم يكون رقمًا صحيحًا بدون كسور")
    .min(0, "الرصيد لا يقبل السالب"),
  differenceNote: z.string().trim().max(500).optional().nullable(),
});

/**
 * إقفال اليوم: يحسب الرصيد المحسوب، يسجل الرصيد الفعلي، ويحفظ الفرق منفصلًا.
 * الفرق لا يُرحَّل لليوم التالي (BRD 11.6)، والإقفال بالترتيب إجباري (قرار 35).
 */
export async function closeDay(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await assertSuperAdmin();
    const parsed = closeSchema.safeParse({
      date: formData.get("date"),
      actualCash: formData.get("actualCash"),
      differenceNote: formData.get("differenceNote") || null,
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
    }

    const day = startOfDay(parsed.data.date);
    const today = startOfDay(new Date());
    if (day.getTime() > today.getTime()) {
      return { error: "لا يمكن إقفال يوم في المستقبل." };
    }

    const systemStart = await getSystemStartDate();
    if (day.getTime() < systemStart.getTime()) {
      return {
        error: `لا يمكن الإقفال قبل تاريخ بداية بيانات النظام (${formatDate(systemStart)}).`,
      };
    }

    const existing = await prisma.dailyClosing.findUnique({ where: { date: day } });
    if (existing?.status === CLOSING_STATUS.CLOSED) {
      return { error: "هذا اليوم مقفول بالفعل." };
    }

    const pending = await oldestUnclosedDayBefore(day);
    if (pending) {
      return {
        error: `لازم تقفل يوم ${formatDate(pending)} الأول — الإقفال لازم يكون بالترتيب عشان الرصيد يترحَّل صح.`,
      };
    }

    const figures = await dayFigures(day);
    const difference = parsed.data.actualCash - figures.calculatedClosing;

    const data = {
      openingBalance: figures.openingBalance,
      collectionsTotal: figures.collectionsTotal,
      expensesTotal: figures.expensesTotal,
      calculatedClosing: figures.calculatedClosing,
      actualCash: parsed.data.actualCash,
      difference,
      differenceNote: parsed.data.differenceNote || null,
      status: CLOSING_STATUS.CLOSED,
      closedAt: new Date(),
      closedById: user.id,
    };

    const closing = await prisma.dailyClosing.upsert({
      where: { date: day },
      update: data,
      create: { date: day, ...data },
    });

    await logAudit({
      user,
      action: AUDIT_ACTION.CLOSE_DAY,
      entity: "DailyClosing",
      entityId: closing.id,
      entityLabel: `إقفال يوم ${formatDate(day)}`,
      before: existing,
      after: closing,
    });

    revalidatePath("/closing");
    revalidatePath("/cash");
    revalidatePath("/");

    if (difference === 0) return { success: "تم إقفال اليوم، والرصيد مطابق." };
    return {
      success:
        difference < 0
          ? `تم إقفال اليوم مع تسجيل عجز ${formatMoney(Math.abs(difference))} ج.م.`
          : `تم إقفال اليوم مع تسجيل زيادة ${formatMoney(difference)} ج.م.`,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "حدث خطأ غير متوقع" };
  }
}

/** فتح يوم مقفول — خطوة صريحة للـSuper Admin قبل أي تعديل (BRD 11.7) */
export async function reopenDay(formData: FormData): Promise<void> {
  const user = await assertSuperAdmin();
  const id = String(formData.get("id") ?? "");
  const closing = await prisma.dailyClosing.findUnique({ where: { id } });
  if (!closing || closing.status !== CLOSING_STATUS.CLOSED) return;

  const after = await prisma.dailyClosing.update({
    where: { id },
    data: {
      status: CLOSING_STATUS.OPEN,
      reopenedAt: new Date(),
      reopenedById: user.id,
      reopenCount: closing.reopenCount + 1,
    },
  });

  await logAudit({
    user,
    action: AUDIT_ACTION.REOPEN_DAY,
    entity: "DailyClosing",
    entityId: id,
    entityLabel: `فتح إقفال يوم ${formatDate(closing.date)}`,
    before: closing,
    after,
  });

  revalidatePath("/closing");
  revalidatePath("/cash");
  revalidatePath("/");
}
