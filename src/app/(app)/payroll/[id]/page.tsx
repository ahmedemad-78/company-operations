import Link from "next/link";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { buildPayrollRows } from "@/lib/payroll-service";
import { getCompanyInfo } from "@/lib/settings";
import {
  Badge,
  Card,
  EmptyState,
  PageHeader,
  Table,
  Td,
  Th,
  buttonSecondaryClass,
} from "@/components/ui";
import { PrintButton } from "@/components/print-button";
import {
  FUNDING_SOURCE_LABEL,
  INCENTIVE_KIND,
  INCENTIVE_KIND_LABEL,
  PAYMENT_STATUS,
  VALUE_TYPE,
  VALUE_TYPE_LABEL,
} from "@/lib/constants";
import {
  formatDate,
  formatMoney,
  formatMonthYear,
  formatQuantity,
} from "@/lib/format";
import { currentMonthKey } from "@/lib/period";

function valueLabel(valueType: string, quantity: number, amount: number) {
  if (valueType === VALUE_TYPE.AMOUNT) return `${formatMoney(amount)} ج.م`;
  return `${formatQuantity(quantity)} ${VALUE_TYPE_LABEL[valueType] ?? valueType} = ${formatMoney(amount)} ج.م`;
}

export default async function PayslipPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  await requireUser();
  const { id } = await params;
  const query = await searchParams;
  const fallback = currentMonthKey();
  const year = Number(query.year) || fallback.year;
  const month = Number(query.month) || fallback.month;

  const [rows, company, incentives, deductions] = await Promise.all([
    buildPayrollRows(year, month),
    getCompanyInfo(),
    prisma.incentive.findMany({
      where: { deletedAt: null, year, month, employeeId: id },
      orderBy: { createdAt: "asc" },
    }),
    prisma.deduction.findMany({
      where: { deletedAt: null, year, month, employeeId: id },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const row = rows.find((item) => item.employee.id === id);
  if (!row) notFound();

  const { computation, summary, employee, line } = row;
  const isPaid = line?.paymentStatus === PAYMENT_STATUS.PAID;

  const earnings = [
    { label: "المرتب الأساسي المستحق", value: computation.earnedBasicSalary },
    { label: "الحوافز", value: computation.incentivesTotal },
    { label: "بدل الإجازة غير المستخدمة", value: computation.unusedLeaveAmount },
    {
      label: `مستحق العمل أيام الجمعة (${summary.workedFridays})`,
      value: computation.fridayEarnings,
    },
  ];

  const deductionRows = [
    {
      label: `خصم الغياب (${summary.absentDays} يوم)`,
      value: computation.absenceDeduction,
    },
    {
      label: `خصم الإجازة الزائدة (${summary.excessLeaveDays} يوم)`,
      value: computation.excessLeaveDeduction,
    },
    { label: "الخصومات", value: computation.deductionsTotal },
    { label: "استقطاع السلفة", value: computation.advanceDeduction },
  ];

  return (
    <>
      <div className="no-print">
        <PageHeader
          title={`مرتب ${employee.name}`}
          description={formatMonthYear(year, month)}
          actions={
            <div className="flex items-center gap-2">
              <Link
                href={`/payroll?year=${year}&month=${month}`}
                className={buttonSecondaryClass}
              >
                رجوع للمرتبات
              </Link>
              <PrintButton />
            </div>
          }
        />
      </div>

      <div className="print-area space-y-6">
        <Card>
          <div className="mb-4 border-b border-slate-100 pb-4 text-center">
            <p className="text-lg font-bold text-slate-900">{company.name}</p>
            {company.address ? (
              <p className="text-xs text-slate-500">{company.address}</p>
            ) : null}
            {company.phone ? (
              <p className="num text-xs text-slate-500">{company.phone}</p>
            ) : null}
            <p className="mt-2 font-semibold text-slate-700">
              قسيمة مرتب — {formatMonthYear(year, month)}
            </p>
          </div>

          <dl className="grid gap-4 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-xs text-slate-500">الموظف</dt>
              <dd className="mt-1 font-medium text-slate-900">{employee.name}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">الوظيفة</dt>
              <dd className="mt-1 text-slate-800">{employee.jobTitle}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">المرتب الأساسي</dt>
              <dd className="num mt-1 text-slate-800">
                {formatMoney(employee.basicSalary)} ج.م
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">قيمة اليوم / الساعة</dt>
              <dd className="num mt-1 text-slate-800">
                {formatMoney(computation.dayValue)} / {formatMoney(computation.hourValue)}
              </dd>
            </div>
          </dl>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="المستحقات">
            <Table>
              <tbody>
                {earnings.map((item) => (
                  <tr key={item.label}>
                    <Td>{item.label}</Td>
                    <Td className="num w-32 text-emerald-700">
                      {formatMoney(item.value)}
                    </Td>
                  </tr>
                ))}
                <tr>
                  <Td className="font-semibold">إجمالي المستحقات</Td>
                  <Td className="num w-32 font-bold">
                    {formatMoney(
                      earnings.reduce((sum, item) => sum + item.value, 0),
                    )}
                  </Td>
                </tr>
              </tbody>
            </Table>
          </Card>

          <Card title="الاستقطاعات">
            <Table>
              <tbody>
                {deductionRows.map((item) => (
                  <tr key={item.label}>
                    <Td>{item.label}</Td>
                    <Td className="num w-32 text-rose-700">
                      {formatMoney(item.value)}
                    </Td>
                  </tr>
                ))}
                <tr>
                  <Td className="font-semibold">إجمالي الاستقطاعات</Td>
                  <Td className="num w-32 font-bold">
                    {formatMoney(
                      deductionRows.reduce((sum, item) => sum + item.value, 0),
                    )}
                  </Td>
                </tr>
              </tbody>
            </Table>
          </Card>
        </div>

        <Card>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm text-slate-500">صافي المرتب</p>
              <p className="num mt-1 text-3xl font-bold text-slate-900">
                {formatMoney(line?.netSalary ?? computation.netSalary)} ج.م
              </p>
            </div>
            <div className="text-sm">
              {isPaid ? (
                <div className="space-y-1 text-left">
                  <Badge tone="success">تم الصرف</Badge>
                  <p className="text-xs text-slate-500">
                    بتاريخ {formatDate(line?.paidAt)} —{" "}
                    {FUNDING_SOURCE_LABEL[line?.fundingSource ?? ""] ?? "—"}
                  </p>
                </div>
              ) : (
                <Badge tone="neutral">لم يتم الصرف</Badge>
              )}
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-400">
            بدل المواصلات مصروف شركة ولا يدخل في صافي المرتب (قرار BRD رقم 9).
          </p>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="تفاصيل الحضور">
            <Table>
              <tbody>
                <tr>
                  <Td>أيام الاستحقاق</Td>
                  <Td className="num w-24">{computation.entitledDays}</Td>
                </tr>
                <tr>
                  <Td>أيام مطلوب فيها حضور</Td>
                  <Td className="num w-24">{row.requiredDays}</Td>
                </tr>
                <tr>
                  <Td>حاضر</Td>
                  <Td className="num w-24">{summary.presentDays}</Td>
                </tr>
                <tr>
                  <Td>غياب</Td>
                  <Td className="num w-24 text-rose-700">{summary.absentDays}</Td>
                </tr>
                <tr>
                  <Td>إجازة (الاستحقاق {employee.monthlyPaidLeaveDays})</Td>
                  <Td className="num w-24">{summary.leaveDays}</Td>
                </tr>
                <tr>
                  <Td>إجازة زائدة (بدون أجر)</Td>
                  <Td className="num w-24 text-amber-700">
                    {summary.excessLeaveDays}
                  </Td>
                </tr>
                <tr>
                  <Td>مرضي</Td>
                  <Td className="num w-24">{summary.sickDays}</Td>
                </tr>
                <tr>
                  <Td>عطلات رسمية</Td>
                  <Td className="num w-24">{summary.holidayDays}</Td>
                </tr>
                <tr>
                  <Td>أيام جمعة مشتغلة</Td>
                  <Td className="num w-24 text-emerald-700">
                    {summary.workedFridays}
                  </Td>
                </tr>
              </tbody>
            </Table>
          </Card>

          <Card title="بنود الحوافز والخصومات">
            {incentives.length === 0 && deductions.length === 0 ? (
              <EmptyState message="لا توجد بنود في هذا الشهر." />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th className="w-28">البند</Th>
                    <Th>القيمة</Th>
                    <Th>السبب / ملاحظة</Th>
                  </tr>
                </thead>
                <tbody>
                  {incentives.map((item) => (
                    <tr key={item.id}>
                      <Td>
                        <Badge
                          tone={
                            item.kind === INCENTIVE_KIND.UNUSED_LEAVE
                              ? "info"
                              : "success"
                          }
                        >
                          {INCENTIVE_KIND_LABEL[item.kind] ?? item.kind}
                        </Badge>
                      </Td>
                      <Td className="num">
                        {valueLabel(item.valueType, item.quantity, item.amount)}
                      </Td>
                      <Td className="text-xs text-slate-500">{item.note || "—"}</Td>
                    </tr>
                  ))}
                  {deductions.map((item) => (
                    <tr key={item.id}>
                      <Td>
                        <Badge tone="danger">خصم</Badge>
                      </Td>
                      <Td className="num">
                        {valueLabel(item.valueType, item.quantity, item.amount)}
                      </Td>
                      <Td className="text-xs text-slate-500">{item.note || "—"}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
            <p className="mt-3 text-xs text-slate-400">
              رصيد السلفة المتبقي بعد هذا الشهر:{" "}
              <span className="num">{formatMoney(row.advanceRemaining)}</span> ج.م
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
