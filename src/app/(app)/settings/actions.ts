"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { assertSuperAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { AUDIT_ACTION, SETTING_KEYS } from "@/lib/constants";
import { formatDate, startOfDay } from "@/lib/format";
import { getSettings, saveSettings } from "@/lib/settings";

export type ActionState = { error?: string; success?: string };

const settingsSchema = z.object({
  COMPANY_NAME: z.string().trim().min(2, "اسم الشركة مطلوب"),
  COMPANY_ADDRESS: z.string().trim().max(200).optional().nullable(),
  COMPANY_PHONE: z.string().trim().max(100).optional().nullable(),
  SYSTEM_START_DATE: z.string().min(1, "تاريخ بداية بيانات النظام مطلوب"),
  OPENING_CASH_BALANCE: z.coerce
    .number({ message: "الرصيد الافتتاحي غير صحيح" })
    .int("المبلغ لازم يكون رقمًا صحيحًا بدون كسور")
    .min(0, "الرصيد لا يقبل السالب"),
  WORK_START: z.string().min(1, "بداية يوم العمل مطلوبة"),
  WORK_END: z.string().min(1, "نهاية يوم العمل مطلوبة"),
});

export async function updateSettings(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await assertSuperAdmin();
    const parsed = settingsSchema.safeParse({
      COMPANY_NAME: formData.get("COMPANY_NAME"),
      COMPANY_ADDRESS: formData.get("COMPANY_ADDRESS") || "",
      COMPANY_PHONE: formData.get("COMPANY_PHONE") || "",
      SYSTEM_START_DATE: formData.get("SYSTEM_START_DATE"),
      OPENING_CASH_BALANCE: formData.get("OPENING_CASH_BALANCE") || 0,
      WORK_START: formData.get("WORK_START"),
      WORK_END: formData.get("WORK_END"),
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
    }

    const before = await getSettings();
    const data = parsed.data;
    const after: Record<string, string> = {
      [SETTING_KEYS.COMPANY_NAME]: data.COMPANY_NAME,
      [SETTING_KEYS.COMPANY_ADDRESS]: data.COMPANY_ADDRESS ?? "",
      [SETTING_KEYS.COMPANY_PHONE]: data.COMPANY_PHONE ?? "",
      [SETTING_KEYS.SYSTEM_START_DATE]: data.SYSTEM_START_DATE,
      [SETTING_KEYS.OPENING_CASH_BALANCE]: String(data.OPENING_CASH_BALANCE),
      [SETTING_KEYS.WORK_START]: data.WORK_START,
      [SETTING_KEYS.WORK_END]: data.WORK_END,
    };

    await saveSettings(after);
    await logAudit({
      user,
      action: AUDIT_ACTION.UPDATE,
      entity: "Setting",
      entityLabel: "إعدادات النظام",
      before,
      after,
    });

    revalidatePath("/settings");
    revalidatePath("/");
    return { success: "تم حفظ الإعدادات" };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "حدث خطأ غير متوقع" };
  }
}

const holidaySchema = z.object({
  date: z.string().min(1, "تاريخ العطلة مطلوب"),
  name: z.string().trim().min(2, "اسم العطلة مطلوب"),
});

/** العطلة الرسمية تُسجَّل مرة واحدة للشركة كلها (قرار BRD رقم 30) */
export async function addHoliday(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await assertSuperAdmin();
    const parsed = holidaySchema.safeParse({
      date: formData.get("date"),
      name: formData.get("name"),
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
    }

    const date = startOfDay(parsed.data.date);
    const existing = await prisma.companyHoliday.findUnique({ where: { date } });
    if (existing && !existing.deletedAt) {
      return { error: `يوم ${formatDate(date)} مسجل بالفعل كعطلة رسمية.` };
    }

    const holiday = existing
      ? await prisma.companyHoliday.update({
          where: { date },
          data: { name: parsed.data.name, deletedAt: null, deletedById: null },
        })
      : await prisma.companyHoliday.create({
          data: { date, name: parsed.data.name, createdById: user.id },
        });

    await logAudit({
      user,
      action: AUDIT_ACTION.CREATE,
      entity: "CompanyHoliday",
      entityId: holiday.id,
      entityLabel: `${holiday.name} — ${formatDate(holiday.date)}`,
      after: holiday,
    });

    revalidatePath("/settings");
    revalidatePath("/attendance");
    return { success: "تم تسجيل العطلة الرسمية" };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "حدث خطأ غير متوقع" };
  }
}

export async function deleteHoliday(formData: FormData): Promise<void> {
  const user = await assertSuperAdmin();
  const id = String(formData.get("id") ?? "");
  const holiday = await prisma.companyHoliday.findUnique({ where: { id } });
  if (!holiday || holiday.deletedAt) return;

  await prisma.companyHoliday.update({
    where: { id },
    data: { deletedAt: new Date(), deletedById: user.id },
  });

  await logAudit({
    user,
    action: AUDIT_ACTION.DELETE,
    entity: "CompanyHoliday",
    entityId: id,
    entityLabel: `${holiday.name} — ${formatDate(holiday.date)}`,
    before: holiday,
  });

  revalidatePath("/settings");
  revalidatePath("/attendance");
}
