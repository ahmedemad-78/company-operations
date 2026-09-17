"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { assertSuperAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { AUDIT_ACTION, QUOTATION_MODE } from "@/lib/constants";
import { startOfDay } from "@/lib/format";

export type ActionState = { error?: string; success?: string };

const moneyField = z.coerce
  .number({ message: "المبلغ غير صحيح" })
  .int("المبلغ لازم يكون رقمًا صحيحًا بدون كسور")
  .min(0, "المبلغ لا يقبل السالب");

/** بند واحد في جدول البنود — بدون ضرائب، والإجمالي يحسبه السيرفر (قرار BRD رقم 23) */
const itemSchema = z.object({
  description: z.string().trim().min(1, "وصف البند مطلوب"),
  quantity: z.coerce
    .number({ message: "الكمية غير صحيحة" })
    .int("الكمية لازم تكون رقمًا صحيحًا بدون كسور")
    .min(1, "الكمية لا تقل عن 1"),
  unitPrice: moneyField,
});

const quotationFields = z.object({
  number: z.string().trim().min(1, "رقم العرض مطلوب"),
  date: z.string().min(1, "تاريخ العرض مطلوب"),
  customerName: z.string().trim().min(2, "اسم العميل مطلوب"),
  customerCompany: z.string().trim().max(200).optional().nullable(),
  customerPhone: z.string().trim().max(50).optional().nullable(),
  mode: z.enum([QUOTATION_MODE.ITEMS, QUOTATION_MODE.LUMP], {
    message: "شكل البنود غير صحيح",
  }),
  lumpDescription: z.string().trim().max(4000).optional().nullable(),
  lumpTotal: moneyField,
  validityNote: z.string().trim().max(500).optional().nullable(),
  terms: z.string().trim().max(4000).optional().nullable(),
  items: z.array(itemSchema),
});

const quotationSchema = quotationFields
  .refine(
    (data) => data.mode !== QUOTATION_MODE.ITEMS || data.items.length > 0,
    {
      message: "أضف بندًا واحدًا على الأقل في جدول البنود",
      path: ["items"],
    },
  )
  .refine(
    (data) => data.mode !== QUOTATION_MODE.LUMP || Boolean(data.lumpDescription),
    {
      message: "وصف الشغل مطلوب عند اختيار «مبلغ إجمالي»",
      path: ["lumpDescription"],
    },
  );

/**
 * صفوف البنود تُرسل بنفس الأسماء المتكررة، فترتيب getAll هو ترتيب الصفوف في الشاشة.
 * الصف الفاضي يُتجاهل: الكمية خارج اختبار "الفاضي" لأن الشاشة تبدأها بـ1 في كل صف جديد.
 */
function readItems(formData: FormData) {
  const descriptions = formData.getAll("itemDescription");
  const quantities = formData.getAll("itemQuantity");
  const unitPrices = formData.getAll("itemUnitPrice");

  return descriptions
    .map((description, index) => ({
      description: String(description ?? "").trim(),
      quantity: String(quantities[index] ?? "").trim(),
      unitPrice: String(unitPrices[index] ?? "").trim(),
    }))
    .filter((row) => row.description !== "" || row.unitPrice !== "");
}

function readForm(formData: FormData) {
  return {
    number: formData.get("number"),
    date: formData.get("date"),
    customerName: formData.get("customerName"),
    customerCompany: formData.get("customerCompany") || null,
    customerPhone: formData.get("customerPhone") || null,
    mode: formData.get("mode"),
    lumpDescription: formData.get("lumpDescription") || null,
    lumpTotal: formData.get("lumpTotal") || 0,
    validityNote: formData.get("validityNote") || null,
    terms: formData.get("terms") || null,
    items: readItems(formData),
  };
}

type ParsedQuotation = z.infer<typeof quotationFields>;

/** السيرفر يعيد حساب كل إجمالي بند والإجمالي العام — لا يُعتمد على أي مبلغ محسوب في المتصفح */
function buildItems(data: ParsedQuotation) {
  if (data.mode !== QUOTATION_MODE.ITEMS) return [];
  return data.items.map((item, index) => ({
    description: item.description,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    lineTotal: item.quantity * item.unitPrice,
    sortOrder: index,
  }));
}

function grandTotal(data: ParsedQuotation): number {
  if (data.mode !== QUOTATION_MODE.ITEMS) return data.lumpTotal;
  return buildItems(data).reduce((sum, item) => sum + item.lineTotal, 0);
}

function commonData(data: ParsedQuotation) {
  return {
    number: data.number,
    date: startOfDay(data.date),
    customerName: data.customerName,
    customerCompany: data.customerCompany || null,
    customerPhone: data.customerPhone || null,
    mode: data.mode,
    lumpDescription:
      data.mode === QUOTATION_MODE.LUMP ? data.lumpDescription || null : null,
    total: grandTotal(data),
    validityNote: data.validityNote || null,
    terms: data.terms || null,
  };
}

function auditLabel(number: string, customerName: string): string {
  return `عرض سعر ${number} — ${customerName}`;
}

export async function createQuotation(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let newId: string;
  try {
    const user = await assertSuperAdmin();
    const parsed = quotationSchema.safeParse(readForm(formData));
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
    }

    const data = parsed.data;
    const items = buildItems(data);
    const quotation = await prisma.quotation.create({
      data: {
        ...commonData(data),
        createdById: user.id,
        ...(items.length > 0 ? { items: { create: items } } : {}),
      },
      include: { items: { orderBy: { sortOrder: "asc" } } },
    });

    await logAudit({
      user,
      action: AUDIT_ACTION.CREATE,
      entity: "Quotation",
      entityId: quotation.id,
      entityLabel: auditLabel(quotation.number, quotation.customerName),
      after: quotation,
    });

    newId = quotation.id;
  } catch (error) {
    return { error: error instanceof Error ? error.message : "حدث خطأ غير متوقع" };
  }

  revalidatePath("/quotations");
  redirect(`/quotations/${newId}`);
}

export async function updateQuotation(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await assertSuperAdmin();
    const id = String(formData.get("id") ?? "");
    const before = await prisma.quotation.findFirst({
      where: { id, deletedAt: null },
      include: { items: { orderBy: { sortOrder: "asc" } } },
    });
    if (!before) return { error: "عرض السعر غير موجود" };

    const parsed = quotationSchema.safeParse(readForm(formData));
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
    }

    const data = parsed.data;
    const items = buildItems(data);

    // البنود تُستبدل بالكامل: أبسط وأضمن من محاولة مطابقة الصفوف القديمة بالجديدة
    const after = await prisma.$transaction(async (tx) => {
      await tx.quotationItem.deleteMany({ where: { quotationId: id } });
      return tx.quotation.update({
        where: { id },
        data: {
          ...commonData(data),
          ...(items.length > 0 ? { items: { create: items } } : {}),
        },
        include: { items: { orderBy: { sortOrder: "asc" } } },
      });
    });

    await logAudit({
      user,
      action: AUDIT_ACTION.UPDATE,
      entity: "Quotation",
      entityId: id,
      entityLabel: auditLabel(after.number, after.customerName),
      before,
      after,
    });

    revalidatePath("/quotations");
    revalidatePath(`/quotations/${id}`);
    revalidatePath(`/quotation-print/${id}`);
    return { success: "تم حفظ عرض السعر" };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "حدث خطأ غير متوقع" };
  }
}

/** إلغاء (Soft Delete) — العرض يختفي من الشاشات ويبقى في قاعدة البيانات والـAudit Log */
export async function deleteQuotation(formData: FormData): Promise<void> {
  const user = await assertSuperAdmin();
  const id = String(formData.get("id") ?? "");
  const quotation = await prisma.quotation.findUnique({
    where: { id },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
  if (!quotation || quotation.deletedAt) return;

  await prisma.quotation.update({
    where: { id },
    data: { deletedAt: new Date(), deletedById: user.id },
  });

  await logAudit({
    user,
    action: AUDIT_ACTION.DELETE,
    entity: "Quotation",
    entityId: id,
    entityLabel: auditLabel(quotation.number, quotation.customerName),
    before: quotation,
  });

  revalidatePath("/quotations");
  redirect("/quotations");
}
