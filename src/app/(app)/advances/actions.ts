"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { assertSuperAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { assertDayEditable } from "@/lib/cash";
import {
  AUDIT_ACTION,
  CASH_ORIGIN,
  CASH_TYPE,
  FUNDING_SOURCE,
} from "@/lib/constants";
import { formatDate, formatMoney, startOfDay } from "@/lib/format";

export type ActionState = { error?: string; success?: string };

const advanceSchema = z.object({
  employeeId: z.string().min(1, "الموظف مطلوب"),
  amount: z.coerce
    .number({ message: "المبلغ غير صحيح" })
    .int("المبلغ لازم يكون رقمًا صحيحًا بدون كسور")
    .positive("المبلغ لازم يكون أكبر من صفر"),
  date: z.string().min(1, "التاريخ مطلوب"),
  fundingSource: z.enum([
    FUNDING_SOURCE.COMPANY_CASH,
    FUNDING_SOURCE.MANAGER_PERSONAL,
  ]),
  isOpeningBalance: z.coerce.boolean().optional(),
  note: z.string().trim().max(500).optional().nullable(),
});

/**
 * تسجيل سلفة: مصروف نقدي (لو من خزنة الشركة) + رصيد على الموظف يُستقطع من المرتب يدويًا.
 * السلف القائمة القديمة تُدخَل كـ"رصيد افتتاحي" فلا تُنشئ حركة خزنة (BRD 15).
 */
export async function createAdvance(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await assertSuperAdmin();
    const parsed = advanceSchema.safeParse({
      employeeId: formData.get("employeeId"),
      amount: formData.get("amount"),
      date: formData.get("date"),
      fundingSource: formData.get("fundingSource") || FUNDING_SOURCE.COMPANY_CASH,
      isOpeningBalance: formData.get("isOpeningBalance") === "on",
      note: formData.get("note") || null,
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
    }

    const data = parsed.data;
    const date = startOfDay(data.date);
    const employee = await prisma.employee.findFirst({
      where: { id: data.employeeId, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!employee) return { error: "الموظف غير موجود" };

    const createsCashMovement =
      !data.isOpeningBalance && data.fundingSource === FUNDING_SOURCE.COMPANY_CASH;
    if (createsCashMovement) await assertDayEditable(date);

    const advance = await prisma.$transaction(async (tx) => {
      const created = await tx.advance.create({
        data: {
          employeeId: employee.id,
          amount: data.amount,
          date,
          fundingSource: data.fundingSource,
          isOpeningBalance: data.isOpeningBalance ?? false,
          note: data.note || null,
          createdById: user.id,
        },
      });

      if (!data.isOpeningBalance) {
        await tx.cashTransaction.create({
          data: {
            date,
            type: CASH_TYPE.EXPENSE,
            amount: data.amount,
            counterparty: `سلفة — ${employee.name}`,
            fundingSource: data.fundingSource,
            origin: CASH_ORIGIN.ADVANCE,
            advanceId: created.id,
            note: data.note || null,
            createdById: user.id,
          },
        });
      }

      return created;
    });

    await logAudit({
      user,
      action: AUDIT_ACTION.CREATE,
      entity: "Advance",
      entityId: advance.id,
      entityLabel: `سلفة ${employee.name} — ${formatMoney(data.amount)} ج.م — ${formatDate(date)}`,
      after: advance,
    });

    revalidatePath("/advances");
    revalidatePath("/cash");
    revalidatePath("/closing");
    revalidatePath("/payroll");
    revalidatePath("/");
    return {
      success: data.isOpeningBalance
        ? "تم تسجيل السلفة كرصيد افتتاحي (بدون حركة خزنة)"
        : "تم تسجيل السلفة",
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "حدث خطأ غير متوقع" };
  }
}

/** إلغاء سلفة — يلغي معها حركة الخزنة المرتبطة */
export async function deleteAdvance(formData: FormData): Promise<void> {
  const user = await assertSuperAdmin();
  const id = String(formData.get("id") ?? "");
  const advance = await prisma.advance.findUnique({
    where: { id },
    include: {
      employee: { select: { name: true } },
      cashTransaction: true,
    },
  });
  if (!advance || advance.deletedAt) return;

  if (advance.cashTransaction && !advance.cashTransaction.deletedAt) {
    await assertDayEditable(advance.cashTransaction.date);
  }

  await prisma.$transaction(async (tx) => {
    await tx.advance.update({
      where: { id },
      data: { deletedAt: new Date(), deletedById: user.id },
    });
    if (advance.cashTransaction && !advance.cashTransaction.deletedAt) {
      await tx.cashTransaction.update({
        where: { id: advance.cashTransaction.id },
        data: { deletedAt: new Date(), deletedById: user.id },
      });
    }
  });

  await logAudit({
    user,
    action: AUDIT_ACTION.DELETE,
    entity: "Advance",
    entityId: id,
    entityLabel: `سلفة ${advance.employee.name} — ${formatMoney(advance.amount)} ج.م`,
    before: advance,
  });

  revalidatePath("/advances");
  revalidatePath("/cash");
  revalidatePath("/closing");
  revalidatePath("/payroll");
  revalidatePath("/");
}
