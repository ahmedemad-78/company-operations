"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { assertSuperAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import {
  AUDIT_ACTION,
  INCENTIVE_KIND,
  PAYROLL_STATUS,
  VALUE_TYPE,
  VALUE_TYPE_LABEL,
} from "@/lib/constants";
import { formatMoney, formatMonthYear } from "@/lib/format";
import { resolveAmount } from "@/lib/payroll";

export type ActionState = { error?: string; success?: string };

const baseSchema = z.object({
  employeeId: z.string().min(1, "الموظف مطلوب"),
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  valueType: z.enum([VALUE_TYPE.AMOUNT, VALUE_TYPE.DAYS, VALUE_TYPE.HOURS], {
    message: "نوع القيمة غير صحيح",
  }),
  quantity: z.coerce.number().min(0).max(400).optional(),
  amount: z.coerce.number().int().min(0).optional(),
  note: z.string().trim().max(500).optional().nullable(),
});

function readForm(formData: FormData) {
  return {
    employeeId: formData.get("employeeId"),
    year: formData.get("year"),
    month: formData.get("month"),
    valueType: formData.get("valueType"),
    quantity: formData.get("quantity") || 0,
    amount: formData.get("amount") || 0,
    note: formData.get("note") || null,
  };
}

/** لا يجوز تعديل بنود شهر مرتب مقفول (BRD 6.5) */
async function assertPeriodOpen(year: number, month: number): Promise<void> {
  const period = await prisma.payrollPeriod.findUnique({
    where: { year_month: { year, month } },
  });
  if (period?.status === PAYROLL_STATUS.LOCKED) {
    throw new Error(
      `مرتب ${formatMonthYear(year, month)} مقفول. افتح الشهر أولًا من شاشة المرتبات.`,
    );
  }
}

async function loadEmployee(employeeId: string) {
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, deletedAt: null },
    select: { id: true, name: true, basicSalary: true },
  });
  if (!employee) throw new Error("الموظف غير موجود");
  return employee;
}

function describe(valueType: string, quantity: number, amount: number): string {
  if (valueType === VALUE_TYPE.AMOUNT) return `${formatMoney(amount)} ج.م`;
  return `${quantity} ${VALUE_TYPE_LABEL[valueType] ?? valueType}`;
}

export async function createIncentive(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await assertSuperAdmin();
    const kind =
      formData.get("kind") === INCENTIVE_KIND.UNUSED_LEAVE
        ? INCENTIVE_KIND.UNUSED_LEAVE
        : INCENTIVE_KIND.INCENTIVE;

    const parsed = baseSchema.safeParse(readForm(formData));
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
    }

    const data = parsed.data;
    await assertPeriodOpen(data.year, data.month);
    const employee = await loadEmployee(data.employeeId);

    const resolved = resolveAmount(
      data.valueType,
      data.quantity ?? 0,
      data.amount ?? 0,
      employee.basicSalary,
    );
    if (resolved <= 0) {
      return { error: "القيمة لازم تكون أكبر من صفر" };
    }

    const record = await prisma.incentive.create({
      data: {
        employeeId: employee.id,
        year: data.year,
        month: data.month,
        kind,
        valueType: data.valueType,
        quantity: data.quantity ?? 0,
        amount: resolved,
        note: data.note || null,
        createdById: user.id,
      },
    });

    await logAudit({
      user,
      action: AUDIT_ACTION.CREATE,
      entity: "Incentive",
      entityId: record.id,
      entityLabel: `${employee.name} — ${formatMonthYear(data.year, data.month)} — ${describe(
        data.valueType,
        data.quantity ?? 0,
        resolved,
      )}`,
      after: record,
    });

    revalidatePath("/adjustments");
    revalidatePath("/payroll");
    return {
      success:
        kind === INCENTIVE_KIND.UNUSED_LEAVE
          ? `تم تسجيل بدل الإجازة (${formatMoney(resolved)} ج.م)`
          : `تم تسجيل الحافز (${formatMoney(resolved)} ج.م)`,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "حدث خطأ غير متوقع" };
  }
}

export async function createDeduction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await assertSuperAdmin();
    const parsed = baseSchema.safeParse(readForm(formData));
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
    }

    const data = parsed.data;
    await assertPeriodOpen(data.year, data.month);
    const employee = await loadEmployee(data.employeeId);

    const resolved = resolveAmount(
      data.valueType,
      data.quantity ?? 0,
      data.amount ?? 0,
      employee.basicSalary,
    );
    if (resolved <= 0) {
      return { error: "القيمة لازم تكون أكبر من صفر" };
    }

    const record = await prisma.deduction.create({
      data: {
        employeeId: employee.id,
        year: data.year,
        month: data.month,
        valueType: data.valueType,
        quantity: data.quantity ?? 0,
        amount: resolved,
        note: data.note || null,
        createdById: user.id,
      },
    });

    await logAudit({
      user,
      action: AUDIT_ACTION.CREATE,
      entity: "Deduction",
      entityId: record.id,
      entityLabel: `${employee.name} — ${formatMonthYear(data.year, data.month)} — ${describe(
        data.valueType,
        data.quantity ?? 0,
        resolved,
      )}`,
      after: record,
    });

    revalidatePath("/adjustments");
    revalidatePath("/payroll");
    return { success: `تم تسجيل الخصم (${formatMoney(resolved)} ج.م)` };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "حدث خطأ غير متوقع" };
  }
}

export async function deleteIncentive(formData: FormData): Promise<void> {
  const user = await assertSuperAdmin();
  const id = String(formData.get("id") ?? "");
  const record = await prisma.incentive.findUnique({
    where: { id },
    include: { employee: { select: { name: true } } },
  });
  if (!record || record.deletedAt) return;

  await assertPeriodOpen(record.year, record.month);
  await prisma.incentive.update({
    where: { id },
    data: { deletedAt: new Date(), deletedById: user.id },
  });

  await logAudit({
    user,
    action: AUDIT_ACTION.DELETE,
    entity: "Incentive",
    entityId: id,
    entityLabel: `${record.employee.name} — ${formatMonthYear(record.year, record.month)}`,
    before: record,
  });

  revalidatePath("/adjustments");
  revalidatePath("/payroll");
}

export async function deleteDeduction(formData: FormData): Promise<void> {
  const user = await assertSuperAdmin();
  const id = String(formData.get("id") ?? "");
  const record = await prisma.deduction.findUnique({
    where: { id },
    include: { employee: { select: { name: true } } },
  });
  if (!record || record.deletedAt) return;

  await assertPeriodOpen(record.year, record.month);
  await prisma.deduction.update({
    where: { id },
    data: { deletedAt: new Date(), deletedById: user.id },
  });

  await logAudit({
    user,
    action: AUDIT_ACTION.DELETE,
    entity: "Deduction",
    entityId: id,
    entityLabel: `${record.employee.name} — ${formatMonthYear(record.year, record.month)}`,
    before: record,
  });

  revalidatePath("/adjustments");
  revalidatePath("/payroll");
}
