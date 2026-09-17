import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { getCurrentUser, isSuperAdmin } from "@/lib/auth";
import {
  Badge,
  Card,
  EmptyState,
  PageHeader,
  Table,
  Td,
  Th,
  buttonClass,
  buttonSecondaryClass,
  inputClass,
} from "@/components/ui";
import { QUOTATION_MODE, QUOTATION_MODE_LABEL } from "@/lib/constants";
import { formatDate, formatMoney } from "@/lib/format";

export default async function QuotationsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; mode?: string }>;
}) {
  const { q, mode } = await searchParams;
  const user = await getCurrentUser();
  const canEdit = isSuperAdmin(user);

  const quotations = await prisma.quotation.findMany({
    where: {
      deletedAt: null,
      ...(mode === QUOTATION_MODE.ITEMS || mode === QUOTATION_MODE.LUMP
        ? { mode }
        : {}),
      ...(q
        ? {
            OR: [
              { number: { contains: q } },
              { customerName: { contains: q } },
              { customerCompany: { contains: q } },
            ],
          }
        : {}),
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });

  return (
    <>
      <PageHeader
        title="عروض الأسعار"
        description="إنشاء عرض السعر وطباعته أو حفظه PDF — بدون ضرائب، والأسعار نهائية"
        actions={
          canEdit ? (
            <Link href="/quotations/new" className={buttonClass}>
              عرض سعر جديد
            </Link>
          ) : null
        }
      />

      <Card
        title="العروض المحفوظة"
        description={`عدد العروض المعروضة: ${formatMoney(quotations.length)}`}
      >
        <form className="mb-4 flex flex-wrap items-end gap-3">
          <div className="min-w-48">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">
              بحث برقم العرض أو اسم العميل
            </span>
            <input name="q" defaultValue={q ?? ""} className={inputClass} />
          </div>
          <div className="min-w-40">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">
              شكل البنود
            </span>
            <select name="mode" defaultValue={mode ?? ""} className={inputClass}>
              <option value="">الكل</option>
              <option value={QUOTATION_MODE.ITEMS}>
                {QUOTATION_MODE_LABEL[QUOTATION_MODE.ITEMS]}
              </option>
              <option value={QUOTATION_MODE.LUMP}>
                {QUOTATION_MODE_LABEL[QUOTATION_MODE.LUMP]}
              </option>
            </select>
          </div>
          <button type="submit" className={buttonSecondaryClass}>
            تطبيق
          </button>
        </form>

        {quotations.length === 0 ? (
          <EmptyState message="لا توجد عروض أسعار مطابقة للبحث." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>رقم العرض</Th>
                <Th>التاريخ</Th>
                <Th>العميل</Th>
                <Th>الشركة / الجهة</Th>
                <Th>شكل البنود</Th>
                <Th>الإجمالي</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {quotations.map((quotation) => (
                <tr key={quotation.id} className="hover:bg-slate-50">
                  <Td className="num font-medium text-slate-900">
                    {quotation.number}
                  </Td>
                  <Td className="num">{formatDate(quotation.date)}</Td>
                  <Td>{quotation.customerName}</Td>
                  <Td className="text-slate-500">
                    {quotation.customerCompany || "—"}
                  </Td>
                  <Td>
                    <Badge
                      tone={
                        quotation.mode === QUOTATION_MODE.ITEMS
                          ? "info"
                          : "neutral"
                      }
                    >
                      {QUOTATION_MODE_LABEL[quotation.mode] ?? quotation.mode}
                    </Badge>
                  </Td>
                  <Td className="num font-medium text-slate-900">
                    {formatMoney(quotation.total)}
                  </Td>
                  <Td>
                    <div className="flex items-center gap-3">
                      <Link
                        href={`/quotations/${quotation.id}`}
                        className="text-sm font-medium text-brand-600 hover:underline"
                      >
                        التفاصيل
                      </Link>
                      <Link
                        href={`/quotation-print/${quotation.id}`}
                        target="_blank"
                        className="text-sm font-medium text-slate-600 hover:underline"
                      >
                        طباعة
                      </Link>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
