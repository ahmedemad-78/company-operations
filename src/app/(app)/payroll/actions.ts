"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { assertSuperAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { assertDayEditable } from "@/lib/cash";
import { advanceBalanceFor } from "@/lib/advances";
import {
  AUDIT_ACTION,
  CASH_ORIGIN,
  CASH_TYPE,
  FUNDING_SOURCE,
  PAYMENT_STATUS,
  PAYROLL_STATUS,
} from "@/lib/constants";
import { formatMoney, formatMonthYear, startOfDay } from "@/lib/format";
import { buildPayrollRows, missingAttendanceDays } from "@/lib/payroll-service";

export type ActionState = { error?: string; success?: string };

async function getOrCreatePeriod(year: number, month: number) {
  const existing = await prisma.payrollPeriod.findUnique({
    where: { year_month: { year, month } },
  });
  if (existing) return existing;
  return prisma.payrollPeriod.create({ data: { year, month } });
}

async function assertPeriodOpen(year: number, month: number) {
  const period = await prisma.payrollPeriod.findUnique({
    where: { year_month: { year, month } },
  });
  if (period?.status === PAYROLL_STATUS.LOCKED) {
    throw new Error(
      `مرتب ${formatMonthYear(year, month)} مقفول. افتح الشهر أولًا قبل التعديل.`,
    );
  }
  return period;
}

/**
 * حساب (أو إعادة حساب) مرتبات الشهر من الحضور والحوافز والخصومات.
 * لا يمس المرتبات المصروفة — لازم إلغاء الصرف أولًا حتى تبقى حركة الخزنة متسقة.
 */
export async function recalculatePayroll(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await assertSuperAdmin();
    const year = Number(formData.get("year"));
    const month = Number(formData.get("month"));
    if (!year || !month) return { error: "الشهر غير صحيح" };

    await assertPeriodOpen(year, month);
    const period = await getOrCreatePeriod(year, month);
    const rows = await buildPayrollRows(year, month);

    let saved = 0;
    let skippedPaid = 0;

    for (const row of rows) {
      if (row.line?.paymentStatus === PAYMENT_STATUS.PAID) {
        skippedPaid += 1;
        continue;
      }

      const data = {
        basicSalary: row.employee.basicSalary,
        dayValue: row.computation.dayValue,
        hourValue: row.computation.hourValue,
        entitledDays: row.computation.entitledDays,
        earnedBasicSalary: row.computation.earnedBasicSalary,
        incentivesTotal: row.computation.incentivesTotal,
        unusedLeaveAmount: row.computation.unusedLeaveAmount,
        fridayEarnings: row.computation.fridayEarnings,
        absenceDeduction: row.computation.absenceDeduction,
        excessLeaveDeduction: row.computation.excessLeaveDeduction,
        deductionsTotal: row.computation.deductionsTotal,
        advanceDeduction: row.computation.advanceDeduction,
        netSalary: row.computation.netSalary,
        presentDays: row.summary.presentDays,
        absentDays: row.summary.absentDays,
        leaveDays: row.summary.leaveDays,
        excessLeaveDays: row.summary.excessLeaveDays,
        sickDays: row.summary.sickDays,
        holidayDays: row.summary.holidayDays,
        workedFridays: row.summary.workedFridays,
      };

      await prisma.payrollLine.upsert({
        where: {
          periodId_employeeId: {
            periodId: period.id,
            employeeId: row.employee.id,
          },
        },
        update: data,
        create: {
          periodId: period.id,
          employeeId: row.employee.id,
          ...data,
        },
      });
      saved += 1;
    }

    await logAudit({
      user,
      action: AUDIT_ACTION.UPDATE,
      entity: "PayrollPeriod",
      entityId: period.id,
      entityLabel: `حساب مرتبات ${formatMonthYear(year, month)}`,
      after: { saved, skippedPaid },
    });

    revalidatePath("/payroll");
    return {
      success: `تم حساب مرتبات ${saved} موظف.${
        skippedPaid > 0 ? ` (${skippedPaid} مرتب مصروف لم يتغير)` : ""
      }`,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "حدث خطأ غير متوقع" };
  }
}

const advanceSchema = z.object({
  lineId: z.string().min(1),
  advanceDeduction: z.coerce
    .number({ message: "المبلغ غير صحيح" })
    .int("المبلغ لازم يكون رقمًا صحيحًا بدون كسور")
    .min(0, "المبلغ لا يقبل السالب"),
});

/** استقطاع السلفة يدوي بالكامل، ولا يتجاوز مستحق الشهر (BRD 10) */
export async function setAdvanceDeduction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await assertSuperAdmin();
    const parsed = advanceSchema.safeParse({
      lineId: formData.get("lineId"),
      advanceDeduction: formData.get("advanceDeduction"),
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
    }

    const line = await prisma.payrollLine.findUnique({
      where: { id: parsed.data.lineId },
      include: {
        period: true,
        employee: { select: { id: true, name: true } },
      },
    });
    if (!line) return { error: "سطر المرتب غير موجود" };
    if (line.period.status === PAYROLL_STATUS.LOCKED) {
      return { error: "الشهر مقفول. افتحه أولًا قبل التعديل." };
    }
    if (line.paymentStatus === PAYMENT_STATUS.PAID) {
      return { error: "المرتب مصروف بالفعل. ألغِ الصرف أولًا قبل تعديل الاستقطاع." };
    }

    const netBeforeAdvance =
      line.earnedBasicSalary +
      line.incentivesTotal +
      line.unusedLeaveAmount +
      line.fridayEarnings -
      line.absenceDeduction -
      line.excessLeaveDeduction -
      line.deductionsTotal;

    const balance = await advanceBalanceFor(line.employee.id);
    const available = balance.remaining + line.advanceDeduction;

    if (parsed.data.advanceDeduction > available) {
      return {
        error: `رصيد السلفة المتبقي ${formatMoney(available)} ج.م فقط.`,
      };
    }
    if (parsed.data.advanceDeduction > Math.max(0, netBeforeAdvance)) {
      return {
        error: `لا يمكن استقطاع أكثر من مستحق الشهر (${formatMoney(Math.max(0, netBeforeAdvance))} ج.م). الباقي يفضل في رصيد السلفة للشهر الجاي.`,
      };
    }

    const after = await prisma.payrollLine.update({
      where: { id: line.id },
      data: {
        advanceDeduction: parsed.data.advanceDeduction,
        netSalary: Math.max(0, netBeforeAdvance) - parsed.data.advanceDeduction,
      },
    });

    await logAudit({
      user,
      action: AUDIT_ACTION.UPDATE,
      entity: "PayrollLine",
      entityId: line.id,
      entityLabel: `استقطاع سلفة ${line.employee.name} — ${formatMonthYear(
        line.period.year,
        line.period.month,
      )}`,
      before: { advanceDeduction: line.advanceDeduction, netSalary: line.netSalary },
      after: { advanceDeduction: after.advanceDeduction, netSalary: after.netSalary },
    });

    revalidatePath("/payroll");
    revalidatePath("/advances");
    return { success: "تم تسجيل الاستقطاع" };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "حدث خطأ غير متوقع" };
  }
}

const paySchema = z.object({
  lineId: z.string().min(1),
  paidAt: z.string().min(1, "تاريخ الصرف مطلوب"),
  fundingSource: z.enum([
    FUNDING_SOURCE.COMPANY_CASH,
    FUNDING_SOURCE.MANAGER_PERSONAL,
  ]),
});

/**
 * صرف المرتب: مرة واحدة بالكامل من مصدر واحد (قرار 13).
 * الصرف من خزنة الشركة يُنشئ مصروف خزنة تلقائيًا بقيمة الصافي (قرار 26).
 */
export async function paySalary(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await assertSuperAdmin();
    const parsed = paySchema.safeParse({
      lineId: formData.get("lineId"),
      paidAt: formData.get("paidAt"),
      fundingSource: formData.get("fundingSource") || FUNDING_SOURCE.COMPANY_CASH,
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
    }

    const line = await prisma.payrollLine.findUnique({
      where: { id: parsed.data.lineId },
      include: {
        period: true,
        employee: { select: { name: true } },
        cashTransaction: true,
      },
    });
    if (!line) return { error: "سطر المرتب غير موجود" };
    if (line.paymentStatus === PAYMENT_STATUS.PAID) {
      return { error: "المرتب مصروف بالفعل." };
    }
    if (line.netSalary <= 0) {
      return { error: "صافي المرتب صفر — مفيش مبلغ للصرف." };
    }

    const paidAt = startOfDay(parsed.data.paidAt);
    const createsCashMovement =
      parsed.data.fundingSource === FUNDING_SOURCE.COMPANY_CASH;
    if (createsCashMovement) await assertDayEditable(paidAt);

    await prisma.$transaction(async (tx) => {
      await tx.payrollLine.update({
        where: { id: line.id },
        data: {
          paymentStatus: PAYMENT_STATUS.PAID,
          paidAt,
          fundingSource: parsed.data.fundingSource,
        },
      });

      if (createsCashMovement) {
        await tx.cashTransaction.create({
          data: {
            date: paidAt,
            type: CASH_TYPE.EXPENSE,
            amount: line.netSalary,
            counterparty: `مرتب ${line.employee.name} — ${formatMonthYear(
              line.period.year,
              line.period.month,
            )}`,
            fundingSource: FUNDING_SOURCE.COMPANY_CASH,
            origin: CASH_ORIGIN.SALARY,
            payrollLineId: line.id,
            createdById: user.id,
          },
        });
      }
    });

    await logAudit({
      user,
      action: AUDIT_ACTION.PAY_SALARY,
      entity: "PayrollLine",
      entityId: line.id,
      entityLabel: `صرف مرتب ${line.employee.name} — ${formatMonthYear(
        line.period.year,
        line.period.month,
      )} — ${formatMoney(line.netSalary)} ج.م`,
      before: { paymentStatus: line.paymentStatus },
      after: {
        paymentStatus: PAYMENT_STATUS.PAID,
        paidAt,
        fundingSource: parsed.data.fundingSource,
        amount: line.netSalary,
      },
    });

    revalidatePath("/payroll");
    revalidatePath("/cash");
    revalidatePath("/closing");
    revalidatePath("/");
    return {
      success: createsCashMovement
        ? `تم صرف المرتب، واتسجل مصروف خزنة بقيمة ${formatMoney(line.netSalary)} ج.م.`
        : "تم تسجيل الصرف (من مال المدير — بدون حركة خزنة).",
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "حدث خطأ غير متوقع" };
  }
}

/** إلغاء الصرف — يلغي معه حركة الخزنة المرتبطة (لازم يكون اليوم مفتوحًا) */
export async function cancelSalaryPayment(formData: FormData): Promise<void> {
  const user = await assertSuperAdmin();
  const lineId = String(formData.get("lineId") ?? "");
  const line = await prisma.payrollLine.findUnique({
    where: { id: lineId },
    include: {
      period: true,
      employee: { select: { name: true } },
      cashTransaction: true,
    },
  });
  if (!line || line.paymentStatus !== PAYMENT_STATUS.PAID) return;
  if (line.period.status === PAYROLL_STATUS.LOCKED) return;

  if (line.cashTransaction && !line.cashTransaction.deletedAt) {
    await assertDayEditable(line.cashTransaction.date);
  }

  await prisma.$transaction(async (tx) => {
    await tx.payrollLine.update({
      where: { id: line.id },
      data: { paymentStatus: PAYMENT_STATUS.UNPAID, paidAt: null, fundingSource: null },
    });
    if (line.cashTransaction && !line.cashTransaction.deletedAt) {
      await tx.cashTransaction.update({
        where: { id: line.cashTransaction.id },
        data: { deletedAt: new Date(), deletedById: user.id },
      });
    }
  });

  await logAudit({
    user,
    action: AUDIT_ACTION.UPDATE,
    entity: "PayrollLine",
    entityId: line.id,
    entityLabel: `إلغاء صرف مرتب ${line.employee.name} — ${formatMonthYear(
      line.period.year,
      line.period.month,
    )}`,
    before: { paymentStatus: PAYMENT_STATUS.PAID, paidAt: line.paidAt },
    after: { paymentStatus: PAYMENT_STATUS.UNPAID },
  });

  revalidatePath("/payroll");
  revalidatePath("/cash");
  revalidatePath("/closing");
  revalidatePath("/");
}

/** إقفال مرتب الشهر — ممنوع قبل تسجيل كل أيام الحضور (قرار BRD رقم 17) */
export async function lockPayroll(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await assertSuperAdmin();
    const year = Number(formData.get("year"));
    const month = Number(formData.get("month"));
    if (!year || !month) return { error: "الشهر غير صحيح" };

    const missing = await missingAttendanceDays(year, month);
    if (missing.length > 0) {
      const details = missing
        .slice(0, 5)
        .map((row) => `${row.employeeName} (${row.days} يوم)`)
        .join("، ");
      return {
        error: `فيه أيام حضور غير مسجلة: ${details}${
          missing.length > 5 ? " وغيرهم" : ""
        }. سجّلها الأول من شاشة الحضور.`,
      };
    }

    const period = await getOrCreatePeriod(year, month);
    if (period.status === PAYROLL_STATUS.LOCKED) {
      return { error: "الشهر مقفول بالفعل." };
    }

    const after = await prisma.payrollPeriod.update({
      where: { id: period.id },
      data: {
        status: PAYROLL_STATUS.LOCKED,
        lockedAt: new Date(),
        lockedById: user.id,
      },
    });

    await logAudit({
      user,
      action: AUDIT_ACTION.LOCK_PAYROLL,
      entity: "PayrollPeriod",
      entityId: period.id,
      entityLabel: `إقفال مرتبات ${formatMonthYear(year, month)}`,
      before: period,
      after,
    });

    revalidatePath("/payroll");
    revalidatePath("/adjustments");
    return { success: `تم إقفال مرتبات ${formatMonthYear(year, month)}.` };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "حدث خطأ غير متوقع" };
  }
}

export async function unlockPayroll(formData: FormData): Promise<void> {
  const user = await assertSuperAdmin();
  const year = Number(formData.get("year"));
  const month = Number(formData.get("month"));
  const period = await prisma.payrollPeriod.findUnique({
    where: { year_month: { year, month } },
  });
  if (!period || period.status !== PAYROLL_STATUS.LOCKED) return;

  const after = await prisma.payrollPeriod.update({
    where: { id: period.id },
    data: { status: PAYROLL_STATUS.OPEN, lockedAt: null, lockedById: null },
  });

  await logAudit({
    user,
    action: AUDIT_ACTION.UNLOCK_PAYROLL,
    entity: "PayrollPeriod",
    entityId: period.id,
    entityLabel: `فتح مرتبات ${formatMonthYear(year, month)}`,
    before: period,
    after,
  });

  revalidatePath("/payroll");
  revalidatePath("/adjustments");
}
