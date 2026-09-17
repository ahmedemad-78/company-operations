"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { assertAnyUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import {
  AUDIT_ACTION,
  BEARING_MOVEMENT_TYPE,
  BEARING_MOVEMENT_TYPE_LABEL,
} from "@/lib/constants";
import { formatDate, formatQuantity, startOfDay } from "@/lib/format";

export type ActionState = { error?: string; success?: string };

const MOVEMENT_TYPES = [
  BEARING_MOVEMENT_TYPE.OPENING,
  BEARING_MOVEMENT_TYPE.IN,
  BEARING_MOVEMENT_TYPE.OUT,
] as const;

const movementSchema = z.object({
  type: z.enum(MOVEMENT_TYPES, { message: "نوع الحركة غير صحيح" }),
  date: z.string().min(1, "تاريخ الحركة مطلوب"),
  quantity: z.coerce
    .number({ message: "الكمية غير صحيحة" })
    .int("الكمية لازم تكون رقمًا صحيحًا بدون كسور")
    .positive("الكمية لازم تكون أكبر من صفر"),
  note: z.string().trim().max(500, "الملاحظات طويلة جدًا").optional().nullable(),
});

function readForm(formData: FormData) {
  return {
    type: formData.get("type"),
    date: formData.get("date"),
    quantity: formData.get("quantity"),
    note: formData.get("note") || null,
  };
}

type MovementLike = {
  id: string;
  date: Date;
  type: string;
  quantity: number;
  createdAt: Date;
};

/** الوارد والرصيد الافتتاحي يزيدان الكمية، والاستخدام ينقصها */
function signedQuantity(movement: { type: string; quantity: number }): number {
  return movement.type === BEARING_MOVEMENT_TYPE.OUT
    ? -movement.quantity
    : movement.quantity;
}

function totalQuantity(movements: { type: string; quantity: number }[]): number {
  return movements.reduce((sum, movement) => sum + signedQuantity(movement), 0);
}

/** كل الحركات السارية (غير الملغاة) مرتبة زمنيًا */
async function loadMovements(): Promise<MovementLike[]> {
  return prisma.bearingMovement.findMany({
    where: { deletedAt: null },
    select: { id: true, date: true, type: true, quantity: true, createdAt: true },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
  });
}

/**
 * الكمية لا تنزل تحت الصفر في أي نقطة زمنية (قرار BRD رقم 10).
 * ترجع أول يوم يظهر فيه رصيد سالب، أو null لو كل شيء سليم.
 */
function firstNegativePoint(
  movements: MovementLike[],
): { date: Date; balance: number } | null {
  const sorted = [...movements].sort(
    (a, b) =>
      a.date.getTime() - b.date.getTime() ||
      a.createdAt.getTime() - b.createdAt.getTime(),
  );

  let balance = 0;
  for (const movement of sorted) {
    balance += signedQuantity(movement);
    if (balance < 0) return { date: movement.date, balance };
  }
  return null;
}

function movementLabel(movement: { type: string; quantity: number; date: Date }): string {
  const typeLabel = BEARING_MOVEMENT_TYPE_LABEL[movement.type] ?? movement.type;
  return `رومان بلي — ${typeLabel} ${formatQuantity(movement.quantity)} قطعة بتاريخ ${formatDate(movement.date)}`;
}

export async function createBearingMovement(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await assertAnyUser();
    const parsed = movementSchema.safeParse(readForm(formData));
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
    }

    const data = parsed.data;
    const existing = await loadMovements();
    const candidate: MovementLike = {
      id: "__new__",
      date: startOfDay(data.date),
      type: data.type,
      quantity: data.quantity,
      createdAt: new Date(),
    };

    const negative = firstNegativePoint([...existing, candidate]);
    if (negative) {
      return {
        error: `الكمية مش هتكفي: الحركة دي هتخلي الرصيد ${formatQuantity(negative.balance)} قطعة بتاريخ ${formatDate(negative.date)}. الكمية الحالية ${formatQuantity(totalQuantity(existing))} قطعة.`,
      };
    }

    const movement = await prisma.bearingMovement.create({
      data: {
        date: candidate.date,
        type: data.type,
        quantity: data.quantity,
        note: data.note || null,
        createdById: user.id,
      },
    });

    await logAudit({
      user,
      action: AUDIT_ACTION.CREATE,
      entity: "BearingMovement",
      entityId: movement.id,
      entityLabel: movementLabel(movement),
      after: movement,
    });

    revalidatePath("/bearings");
    return { success: "تم تسجيل الحركة" };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "حدث خطأ غير متوقع" };
  }
}

export async function updateBearingMovement(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await assertAnyUser();
    const id = String(formData.get("id") ?? "");
    const before = await prisma.bearingMovement.findFirst({
      where: { id, deletedAt: null },
    });
    if (!before) return { error: "الحركة غير موجودة أو ملغاة" };

    const parsed = movementSchema.safeParse(readForm(formData));
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
    }

    const data = parsed.data;
    const existing = await loadMovements();
    const projected = existing.map((movement) =>
      movement.id === id
        ? {
            ...movement,
            date: startOfDay(data.date),
            type: data.type,
            quantity: data.quantity,
          }
        : movement,
    );

    const negative = firstNegativePoint(projected);
    if (negative) {
      return {
        error: `التعديل ده هيخلي الرصيد ${formatQuantity(negative.balance)} قطعة بتاريخ ${formatDate(negative.date)}. الكمية لا يمكن أن تنزل تحت الصفر.`,
      };
    }

    const after = await prisma.bearingMovement.update({
      where: { id },
      data: {
        date: startOfDay(data.date),
        type: data.type,
        quantity: data.quantity,
        note: data.note || null,
      },
    });

    await logAudit({
      user,
      action: AUDIT_ACTION.UPDATE,
      entity: "BearingMovement",
      entityId: id,
      entityLabel: movementLabel(after),
      before,
      after,
    });

    revalidatePath("/bearings");
    revalidatePath(`/bearings/${id}/edit`);
    return { success: "تم حفظ تعديل الحركة" };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "حدث خطأ غير متوقع" };
  }
}

/** إلغاء (Soft Delete) — الحركة تبقى في قاعدة البيانات والـAudit Log */
export async function deleteBearingMovement(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await assertAnyUser();
    const id = String(formData.get("id") ?? "");
    const movement = await prisma.bearingMovement.findFirst({
      where: { id, deletedAt: null },
    });
    if (!movement) return { error: "الحركة غير موجودة أو ملغاة" };

    const existing = await loadMovements();
    const negative = firstNegativePoint(
      existing.filter((row) => row.id !== id),
    );
    if (negative) {
      return {
        error: `مش هينفع تلغي الحركة دي: الرصيد هيبقى ${formatQuantity(negative.balance)} قطعة بتاريخ ${formatDate(negative.date)}.`,
      };
    }

    await prisma.bearingMovement.update({
      where: { id },
      data: { deletedAt: new Date(), deletedById: user.id },
    });

    await logAudit({
      user,
      action: AUDIT_ACTION.DELETE,
      entity: "BearingMovement",
      entityId: id,
      entityLabel: movementLabel(movement),
      before: movement,
    });

    revalidatePath("/bearings");
    revalidatePath(`/bearings/${id}/edit`);
    return { success: "تم إلغاء الحركة" };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "حدث خطأ غير متوقع" };
  }
}
