"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { assertSuperAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { AUDIT_ACTION, EMPLOYEE_STATUS } from "@/lib/constants";
import { startOfDay } from "@/lib/format";

export type ActionState = { error?: string; success?: string };

const moneyField = z.coerce
  .number({ message: "المبلغ غير صحيح" })
  .int("المبلغ لازم يكون رقمًا صحيحًا بدون كسور")
  .min(0, "المبلغ لا يقبل السالب");

const employeeFields = z.object({
  name: z.string().trim().min(2, "اسم الموظف مطلوب"),
  jobTitle: z.string().trim().min(2, "الوظيفة مطلوبة"),
  basicSalary: moneyField,
  weeklyTransportAllowance: moneyField,
  startDate: z.string().min(1, "تاريخ بداية العمل مطلوب"),
  endDate: z.string().trim().optional().nullable(),
  hasFixedSchedule: z.coerce.boolean(),
  monthlyPaidLeaveDays: z.coerce
    .number({ message: "عدد أيام الإجازة غير صحيح" })
    .int()
    .min(0)
    .max(31),
  note: z.string().trim().max(500).optional().nullable(),
});

/** آخر يوم عمل (لو مكتوب) لازم يكون بعد تاريخ بداية العمل أو نفسه */
const endDateRule = {
  check: (data: { startDate: string; endDate?: string | null }) =>
    !data.endDate || startOfDay(data.endDate) >= startOfDay(data.startDate),
  message: "آخر يوم عمل لا يمكن أن يكون قبل تاريخ بداية العمل",
};

const employeeSchema = employeeFields.refine(endDateRule.check, {
  message: endDateRule.message,
  path: ["endDate"],
});

function readForm(formData: FormData) {
  return {
    name: formData.get("name"),
    jobTitle: formData.get("jobTitle"),
    basicSalary: formData.get("basicSalary"),
    weeklyTransportAllowance: formData.get("weeklyTransportAllowance") || 0,
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate") || null,
    hasFixedSchedule: formData.get("hasFixedSchedule") === "on",
    monthlyPaidLeaveDays: formData.get("monthlyPaidLeaveDays") || 1,
    note: formData.get("note") || null,
  };
}

export async function createEmployee(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let newId: string;
  try {
    const user = await assertSuperAdmin();
    const parsed = employeeSchema.safeParse(readForm(formData));
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
    }

    const data = parsed.data;
    const employee = await prisma.employee.create({
      data: {
        name: data.name,
        jobTitle: data.jobTitle,
        basicSalary: data.basicSalary,
        weeklyTransportAllowance: data.weeklyTransportAllowance,
        startDate: startOfDay(data.startDate),
        endDate: data.endDate ? startOfDay(data.endDate) : null,
        hasFixedSchedule: data.hasFixedSchedule,
        monthlyPaidLeaveDays: data.monthlyPaidLeaveDays,
        note: data.note || null,
        status: EMPLOYEE_STATUS.ACTIVE,
      },
    });

    await logAudit({
      user,
      action: AUDIT_ACTION.CREATE,
      entity: "Employee",
      entityId: employee.id,
      entityLabel: employee.name,
      after: employee,
    });

    newId = employee.id;
  } catch (error) {
    return { error: error instanceof Error ? error.message : "حدث خطأ غير متوقع" };
  }

  revalidatePath("/employees");
  redirect(`/employees/${newId}`);
}

export async function updateEmployee(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await assertSuperAdmin();
    const id = String(formData.get("id") ?? "");
    const before = await prisma.employee.findUnique({ where: { id } });
    if (!before) return { error: "الموظف غير موجود" };

    // المرتب الأساسي لا يُعدَّل من هنا — يتم عبر "تغيير المرتب" لضمان تسجيله في السجل
    const parsed = employeeFields
      .omit({ basicSalary: true })
      .refine(endDateRule.check, {
        message: endDateRule.message,
        path: ["endDate"],
      })
      .safeParse({ ...readForm(formData), basicSalary: before.basicSalary });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
    }

    const data = parsed.data;
    const after = await prisma.employee.update({
      where: { id },
      data: {
        name: data.name,
        jobTitle: data.jobTitle,
        weeklyTransportAllowance: data.weeklyTransportAllowance,
        startDate: startOfDay(data.startDate),
        endDate: data.endDate ? startOfDay(data.endDate) : null,
        hasFixedSchedule: data.hasFixedSchedule,
        monthlyPaidLeaveDays: data.monthlyPaidLeaveDays,
        note: data.note || null,
      },
    });

    await logAudit({
      user,
      action: AUDIT_ACTION.UPDATE,
      entity: "Employee",
      entityId: id,
      entityLabel: after.name,
      before,
      after,
    });

    revalidatePath("/employees");
    revalidatePath(`/employees/${id}`);
    return { success: "تم حفظ بيانات الموظف" };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "حدث خطأ غير متوقع" };
  }
}

const salaryChangeSchema = z.object({
  id: z.string().min(1),
  newSalary: moneyField,
  effectiveDate: z.string().min(1, "تاريخ تطبيق المرتب الجديد مطلوب"),
});

export async function changeSalary(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await assertSuperAdmin();
    const parsed = salaryChangeSchema.safeParse({
      id: formData.get("id"),
      newSalary: formData.get("newSalary"),
      effectiveDate: formData.get("effectiveDate"),
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
    }

    const { id, newSalary, effectiveDate } = parsed.data;
    const employee = await prisma.employee.findUnique({ where: { id } });
    if (!employee) return { error: "الموظف غير موجود" };
    if (employee.basicSalary === newSalary) {
      return { error: "المرتب الجديد مطابق للمرتب الحالي" };
    }

    const change = await prisma.$transaction(async (tx) => {
      const record = await tx.salaryChange.create({
        data: {
          employeeId: id,
          oldSalary: employee.basicSalary,
          newSalary,
          effectiveDate: startOfDay(effectiveDate),
          createdById: user.id,
        },
      });
      await tx.employee.update({
        where: { id },
        data: { basicSalary: newSalary },
      });
      return record;
    });

    await logAudit({
      user,
      action: AUDIT_ACTION.UPDATE,
      entity: "SalaryChange",
      entityId: change.id,
      entityLabel: `تغيير مرتب ${employee.name}`,
      before: { basicSalary: employee.basicSalary },
      after: { basicSalary: newSalary, effectiveDate: change.effectiveDate },
    });

    revalidatePath("/employees");
    revalidatePath(`/employees/${id}`);
    return { success: "تم تسجيل المرتب الجديد في سجل المرتبات" };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "حدث خطأ غير متوقع" };
  }
}

export async function toggleEmployeeStatus(formData: FormData): Promise<void> {
  const user = await assertSuperAdmin();
  const id = String(formData.get("id") ?? "");
  const employee = await prisma.employee.findUnique({ where: { id } });
  if (!employee) return;

  const nextStatus =
    employee.status === EMPLOYEE_STATUS.ACTIVE
      ? EMPLOYEE_STATUS.INACTIVE
      : EMPLOYEE_STATUS.ACTIVE;

  await prisma.employee.update({ where: { id }, data: { status: nextStatus } });

  await logAudit({
    user,
    action: AUDIT_ACTION.UPDATE,
    entity: "Employee",
    entityId: id,
    entityLabel: employee.name,
    before: { status: employee.status },
    after: { status: nextStatus },
  });

  revalidatePath("/employees");
  revalidatePath(`/employees/${id}`);
}

/** إلغاء (Soft Delete) — السجل يبقى في قاعدة البيانات والـAudit Log */
export async function deleteEmployee(formData: FormData): Promise<void> {
  const user = await assertSuperAdmin();
  const id = String(formData.get("id") ?? "");
  const employee = await prisma.employee.findUnique({ where: { id } });
  if (!employee || employee.deletedAt) return;

  await prisma.employee.update({
    where: { id },
    data: { deletedAt: new Date(), deletedById: user.id },
  });

  await logAudit({
    user,
    action: AUDIT_ACTION.DELETE,
    entity: "Employee",
    entityId: id,
    entityLabel: employee.name,
    before: employee,
  });

  revalidatePath("/employees");
  redirect("/employees");
}
