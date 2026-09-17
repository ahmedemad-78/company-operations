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
  CASH_ORIGIN_LABEL,
  CASH_TYPE,
  CASH_TYPE_LABEL,
  FUNDING_SOURCE,
} from "@/lib/constants";
import { formatMoney, startOfDay, toDateInputValue } from "@/lib/format";

export type ActionState = { error?: string; success?: string };

const transactionSchema = z.object({
  type: z.enum([CASH_TYPE.COLLECTION, CASH_TYPE.EXPENSE], {
    message: "نوع الحركة غير صحيح",
  }),
  date: z.string().min(1, "التاريخ مطلوب"),
  amount: z.coerce
    .number({ message: "المبلغ غير صحيح" })
    .int("المبلغ لازم يكون رقمًا صحيحًا بدون كسور")
    .positive("المبلغ لازم يكون أكبر من صفر"),
  counterparty: z.string().trim().min(2, "الجهة / الوصف مطلوب"),
  fundingSource: z.enum([
    FUNDING_SOURCE.COMPANY_CASH,
    FUNDING_SOURCE.MANAGER_PERSONAL,
  ]),
  note: z.string().trim().max(500).optional().nullable(),
});

function readForm(formData: FormData) {
  return {
    type: formData.get("type"),
    date: formData.get("date"),
    amount: formData.get("amount"),
    counterparty: formData.get("counterparty"),
    // التحصيل دائمًا يدخل خزنة الشركة؛ مصدر الصرف يخص المصروفات فقط (BRD 11.2)
    fundingSource:
      formData.get("type") === CASH_TYPE.EXPENSE
        ? formData.get("fundingSource") || FUNDING_SOURCE.COMPANY_CASH
        : FUNDING_SOURCE.COMPANY_CASH,
    note: formData.get("note") || null,
  };
}

function transactionLabel(type: string, counterparty: string, amount: number) {
  return `${CASH_TYPE_LABEL[type] ?? type} — ${counterparty} — ${formatMoney(amount)} ج.م`;
}

export async function createTransaction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await assertSuperAdmin();
    const parsed = transactionSchema.safeParse(readForm(formData));
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
    }

    const data = parsed.data;
    const date = startOfDay(data.date);
    await assertDayEditable(date);

    const transaction = await prisma.cashTransaction.create({
      data: {
        date,
        type: data.type,
        amount: data.amount,
        counterparty: data.counterparty,
        fundingSource: data.fundingSource,
        note: data.note || null,
        origin: CASH_ORIGIN.MANUAL,
        createdById: user.id,
      },
    });

    await logAudit({
      user,
      action: AUDIT_ACTION.CREATE,
      entity: "CashTransaction",
      entityId: transaction.id,
      entityLabel: transactionLabel(data.type, data.counterparty, data.amount),
      after: transaction,
    });

    revalidatePath("/cash");
    revalidatePath("/closing");
    revalidatePath("/");
    return {
      success:
        data.type === CASH_TYPE.COLLECTION
          ? "تم تسجيل التحصيل"
          : "تم تسجيل المصروف",
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "حدث خطأ غير متوقع" };
  }
}

export async function updateTransaction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await assertSuperAdmin();
    const id = String(formData.get("id") ?? "");
    const before = await prisma.cashTransaction.findUnique({ where: { id } });
    if (!before || before.deletedAt) return { error: "الحركة غير موجودة" };

    if (before.origin !== CASH_ORIGIN.MANUAL) {
      return {
        error: `هذه الحركة أنشأها النظام (${CASH_ORIGIN_LABEL[before.origin] ?? before.origin})، عدّلها من شاشتها الأصلية.`,
      };
    }

    const parsed = transactionSchema.safeParse(readForm(formData));
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
    }

    const data = parsed.data;
    const date = startOfDay(data.date);
    // اليومان لازم يكونا مفتوحين: يوم الحركة القديم ويوم الحركة الجديد
    await assertDayEditable(before.date);
    if (date.getTime() !== startOfDay(before.date).getTime()) {
      await assertDayEditable(date);
    }

    const after = await prisma.cashTransaction.update({
      where: { id },
      data: {
        date,
        type: data.type,
        amount: data.amount,
        counterparty: data.counterparty,
        fundingSource: data.fundingSource,
        note: data.note || null,
      },
    });

    await logAudit({
      user,
      action: AUDIT_ACTION.UPDATE,
      entity: "CashTransaction",
      entityId: id,
      entityLabel: transactionLabel(data.type, data.counterparty, data.amount),
      before,
      after,
    });

    revalidatePath("/cash");
    revalidatePath("/closing");
    revalidatePath("/");
    return { success: "تم تعديل الحركة" };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "حدث خطأ غير متوقع" };
  }
}

/** إلغاء (Soft Delete) — قرار BRD رقم 6 */
export async function deleteTransaction(formData: FormData): Promise<void> {
  const user = await assertSuperAdmin();
  const id = String(formData.get("id") ?? "");
  const transaction = await prisma.cashTransaction.findUnique({ where: { id } });
  if (!transaction || transaction.deletedAt) return;
  if (transaction.origin !== CASH_ORIGIN.MANUAL) return;

  await assertDayEditable(transaction.date);

  await prisma.cashTransaction.update({
    where: { id },
    data: { deletedAt: new Date(), deletedById: user.id },
  });

  await logAudit({
    user,
    action: AUDIT_ACTION.DELETE,
    entity: "CashTransaction",
    entityId: id,
    entityLabel: transactionLabel(
      transaction.type,
      transaction.counterparty,
      transaction.amount,
    ),
    before: transaction,
  });

  revalidatePath("/cash");
  revalidatePath("/closing");
  revalidatePath("/");
  revalidatePath(`/cash?date=${toDateInputValue(transaction.date)}`);
}
