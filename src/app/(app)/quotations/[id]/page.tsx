import Link from "next/link";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { getCurrentUser, isSuperAdmin } from "@/lib/auth";
import {
  Card,
  EmptyState,
  PageHeader,
  StatCard,
  Table,
  Td,
  Th,
  buttonClass,
  buttonSecondaryClass,
} from "@/components/ui";
import { QUOTATION_MODE, QUOTATION_MODE_LABEL } from "@/lib/constants";
import { formatDate, formatMoney } from "@/lib/format";
import { QuotationDangerActions } from "./danger-actions";

export default async function QuotationDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  const canEdit = isSuperAdmin(user);

  const quotation = await prisma.quotation.findFirst({
    where: { id, deletedAt: null },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
  if (!quotation) notFound();

  return (
    <>
      <PageHeader
        title={`عرض سعر ${quotation.number}`}
        description={quotation.customerName}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/quotation-print/${quotation.id}`}
              target="_blank"
              className={buttonClass}
            >
              طباعة / حفظ PDF
            </Link>
            <Link href="/quotations" className={buttonSecondaryClass}>
              رجوع للقائمة
            </Link>
            {canEdit ? (
              <Link
                href={`/quotations/${quotation.id}/edit`}
                className={buttonSecondaryClass}
              >
                تعديل العرض
              </Link>
            ) : null}
          </div>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="إجمالي العرض"
          value={`${formatMoney(quotation.total)} ج.م`}
          hint="سعر نهائي بدون ضرائب"
          tone="brand"
        />
        <StatCard label="تاريخ العرض" value={formatDate(quotation.date)} />
        <StatCard
          label="شكل البنود"
          value={QUOTATION_MODE_LABEL[quotation.mode] ?? quotation.mode}
        />
      </div>

      <div className="grid gap-6">
        <Card title="بيانات العميل">
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-3">
            <div>
              <dt className="text-xs text-slate-500">اسم العميل</dt>
              <dd className="mt-1 text-sm text-slate-800">
                {quotation.customerName}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">الشركة / الجهة</dt>
              <dd className="mt-1 text-sm text-slate-800">
                {quotation.customerCompany || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">التليفون</dt>
              <dd className="mt-1 num text-sm text-slate-800">
                {quotation.customerPhone || "—"}
              </dd>
            </div>
          </dl>
        </Card>

        {quotation.mode === QUOTATION_MODE.ITEMS ? (
          <Card title="البنود">
            {quotation.items.length === 0 ? (
              <EmptyState message="لا توجد بنود في هذا العرض." />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>وصف البند</Th>
                    <Th>الكمية</Th>
                    <Th>سعر الوحدة</Th>
                    <Th>الإجمالي</Th>
                  </tr>
                </thead>
                <tbody>
                  {quotation.items.map((item) => (
                    <tr key={item.id}>
                      <Td className="text-slate-800">{item.description}</Td>
                      <Td className="num">{formatMoney(item.quantity)}</Td>
                      <Td className="num">{formatMoney(item.unitPrice)}</Td>
                      <Td className="num font-medium text-slate-900">
                        {formatMoney(item.lineTotal)}
                      </Td>
                    </tr>
                  ))}
                  <tr>
                    <Td className="font-semibold text-slate-800">الإجمالي</Td>
                    <Td />
                    <Td />
                    <Td className="num font-bold text-slate-900">
                      {formatMoney(quotation.total)}
                    </Td>
                  </tr>
                </tbody>
              </Table>
            )}
          </Card>
        ) : (
          <Card title="وصف الشغل">
            <p className="whitespace-pre-wrap text-sm leading-7 text-slate-800">
              {quotation.lumpDescription || "—"}
            </p>
            <p className="mt-4 text-sm text-slate-600">
              المبلغ الإجمالي:{" "}
              <span className="num font-bold text-slate-900">
                {formatMoney(quotation.total)}
              </span>{" "}
              ج.م
            </p>
          </Card>
        )}

        {quotation.validityNote || quotation.terms ? (
          <Card title="الصلاحية والشروط">
            <dl className="grid gap-4">
              {quotation.validityNote ? (
                <div>
                  <dt className="text-xs text-slate-500">صلاحية العرض</dt>
                  <dd className="mt-1 text-sm text-slate-800">
                    {quotation.validityNote}
                  </dd>
                </div>
              ) : null}
              {quotation.terms ? (
                <div>
                  <dt className="text-xs text-slate-500">الشروط والملاحظات</dt>
                  <dd className="mt-1 whitespace-pre-wrap text-sm leading-7 text-slate-800">
                    {quotation.terms}
                  </dd>
                </div>
              ) : null}
            </dl>
          </Card>
        ) : null}

        {canEdit ? (
          <Card title="إجراءات" description="الإلغاء لا يمسح البيانات نهائيًا">
            <QuotationDangerActions quotationId={quotation.id} />
          </Card>
        ) : null}
      </div>
    </>
  );
}
