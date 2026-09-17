"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { assertSuperAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import {
  ATTENDANCE_STATUS,
  ATTENDANCE_STATUS_LABEL,
  AUDIT_ACTION,
  EMPLOYEE_STATUS,
} from "@/lib/constants";
import { formatDate, isFriday, startOfDay } from "@/lib/format";
import { getSystemStartDate } from "@/lib/settings";

export type ActionState = { error?: string; success?: string };

const ALLOWED_STATUSES: string[] = [
  ATTENDANCE_STATUS.PRESENT,
  ATTENDANCE_STATUS.ABSENT,
  ATTENDANCE_STATUS.LEAVE,
  ATTENDANCE_STATUS.SICK,
];

/**
 * حفظ حضور يوم كامل دفعة واحدة.
 * الجمعة: لا يُسجَّل فيها حضور عادي، فقط علامة "اشتغل الجمعة" لمن عمل (BRD 8.5 / قرار 29).
 */
export async function saveAttendance(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await assertSuperAdmin();
    const dateValue = String(formData.get("date") ?? "");
    if (!dateValue) return { error: "التاريخ مطلوب" };

    const date = startOfDay(dateValue);
    const today = startOfDay(new Date());
    if (date.getTime() > today.getTime()) {
      return { error: "لا يمكن تسجيل حضور ليوم في المستقبل." };
    }

    const systemStart = await getSystemStartDate();
    if (date.getTime() < systemStart.getTime()) {
      return {
        error: `لا يمكن تسجيل حضور قبل تاريخ بداية بيانات النظام (${formatDate(systemStart)}).`,
      };
    }

    const holiday = await prisma.companyHoliday.findFirst({
      where: { date, deletedAt: null },
    });

    const employees = await prisma.employee.findMany({
      where: {
        deletedAt: null,
        status: EMPLOYEE_STATUS.ACTIVE,
        startDate: { lte: date },
        OR: [{ endDate: null }, { endDate: { gte: date } }],
      },
      select: { id: true, name: true },
    });

    const existing = await prisma.attendance.findMany({
      where: { date, employeeId: { in: employees.map((e) => e.id) } },
    });
    const existingByEmployee = new Map(existing.map((row) => [row.employeeId, row]));

    const friday = isFriday(date);
    let changed = 0;

    for (const employee of employees) {
      const before = existingByEmployee.get(employee.id);
      const note = String(formData.get(`note_${employee.id}`) ?? "").trim() || null;

      if (friday) {
        const workedFriday = formData.get(`friday_${employee.id}`) === "on";
        if (!workedFriday) {
          // لم يعمل الجمعة: نشيل أي تسجيل قديم لأن الجمعة عطلة أصلًا
          if (before && !before.deletedAt) {
            await prisma.attendance.delete({ where: { id: before.id } });
            await logAudit({
              user,
              action: AUDIT_ACTION.DELETE,
              entity: "Attendance",
              entityId: before.id,
              entityLabel: `${employee.name} — ${formatDate(date)} (إلغاء العمل يوم الجمعة)`,
              before,
            });
            changed += 1;
          }
          continue;
        }

        const after = before
          ? await prisma.attendance.update({
              where: { id: before.id },
              data: {
                status: ATTENDANCE_STATUS.PRESENT,
                workedFriday: true,
                note,
                deletedAt: null,
                deletedById: null,
              },
            })
          : await prisma.attendance.create({
              data: {
                employeeId: employee.id,
                date,
                status: ATTENDANCE_STATUS.PRESENT,
                workedFriday: true,
                note,
                createdById: user.id,
              },
            });

        if (!before || before.workedFriday !== true || before.note !== note) {
          await logAudit({
            user,
            action: before ? AUDIT_ACTION.UPDATE : AUDIT_ACTION.CREATE,
            entity: "Attendance",
            entityId: after.id,
            entityLabel: `${employee.name} — ${formatDate(date)} (عمل يوم الجمعة)`,
            before,
            after,
          });
          changed += 1;
        }
        continue;
      }

      if (holiday) continue; // عطلة رسمية: لا يُسجَّل حضور (قرار 30)

      const status = String(formData.get(`status_${employee.id}`) ?? "");
      if (!ALLOWED_STATUSES.includes(status)) continue;

      if (before && before.status === status && (before.note ?? null) === note) {
        continue;
      }

      const after = before
        ? await prisma.attendance.update({
            where: { id: before.id },
            data: { status, note, deletedAt: null, deletedById: null },
          })
        : await prisma.attendance.create({
            data: {
              employeeId: employee.id,
              date,
              status,
              note,
              createdById: user.id,
            },
          });

      await logAudit({
        user,
        action: before ? AUDIT_ACTION.UPDATE : AUDIT_ACTION.CREATE,
        entity: "Attendance",
        entityId: after.id,
        entityLabel: `${employee.name} — ${formatDate(date)} — ${
          ATTENDANCE_STATUS_LABEL[status] ?? status
        }`,
        before,
        after,
      });
      changed += 1;
    }

    revalidatePath("/attendance");
    revalidatePath("/payroll");

    if (changed === 0) return { success: "لا يوجد تغيير جديد للحفظ." };
    return { success: `تم حفظ حضور ${changed} موظف.` };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "حدث خطأ غير متوقع" };
  }
}

const overrideSchema = z.object({
  employeeId: z.string().min(1, "الموظف مطلوب"),
  date: z.string().min(1, "التاريخ مطلوب"),
  startTime: z.string().min(1, "وقت البداية مطلوب"),
  endTime: z.string().min(1, "وقت النهاية مطلوب"),
  note: z.string().trim().max(200).optional().nullable(),
});

/** تعديل مواعيد موظف في يوم معين بدون تغيير الـDefault Schedule (BRD 8.2) */
export async function saveScheduleOverride(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await assertSuperAdmin();
    const parsed = overrideSchema.safeParse({
      employeeId: formData.get("employeeId"),
      date: formData.get("date"),
      startTime: formData.get("startTime"),
      endTime: formData.get("endTime"),
      note: formData.get("note") || null,
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
    }

    const data = parsed.data;
    const date = startOfDay(data.date);
    const employee = await prisma.employee.findFirst({
      where: { id: data.employeeId, deletedAt: null },
      select: { name: true },
    });
    if (!employee) return { error: "الموظف غير موجود" };

    const before = await prisma.scheduleOverride.findUnique({
      where: { employeeId_date: { employeeId: data.employeeId, date } },
    });

    const after = await prisma.scheduleOverride.upsert({
      where: { employeeId_date: { employeeId: data.employeeId, date } },
      update: {
        startTime: data.startTime,
        endTime: data.endTime,
        note: data.note || null,
        deletedAt: null,
        deletedById: null,
      },
      create: {
        employeeId: data.employeeId,
        date,
        startTime: data.startTime,
        endTime: data.endTime,
        note: data.note || null,
        createdById: user.id,
      },
    });

    await logAudit({
      user,
      action: before ? AUDIT_ACTION.UPDATE : AUDIT_ACTION.CREATE,
      entity: "ScheduleOverride",
      entityId: after.id,
      entityLabel: `${employee.name} — ${formatDate(date)} — ${data.startTime} إلى ${data.endTime}`,
      before,
      after,
    });

    revalidatePath("/attendance");
    return { success: "تم تعديل مواعيد اليوم لهذا الموظف" };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "حدث خطأ غير متوقع" };
  }
}

export async function deleteScheduleOverride(formData: FormData): Promise<void> {
  const user = await assertSuperAdmin();
  const id = String(formData.get("id") ?? "");
  const override = await prisma.scheduleOverride.findUnique({
    where: { id },
    include: { employee: { select: { name: true } } },
  });
  if (!override || override.deletedAt) return;

  await prisma.scheduleOverride.delete({ where: { id } });

  await logAudit({
    user,
    action: AUDIT_ACTION.DELETE,
    entity: "ScheduleOverride",
    entityId: id,
    entityLabel: `${override.employee.name} — ${formatDate(override.date)}`,
    before: override,
  });

  revalidatePath("/attendance");
}
