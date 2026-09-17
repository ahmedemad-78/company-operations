import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { getCurrentUser, isSuperAdmin, requireUser } from "@/lib/auth";
import { buildPayrollRows } from "@/lib/payroll-service";
import {
  Alert,
  Badge,
  Card,
  EmptyState,
  PageHeader,
  StatCard,
  Table,
  Td,
  Th,
  buttonDangerClass,
  buttonSecondaryClass,
} from "@/components/ui";
import { MonthPicker } from "@/components/month-picker";
import { FUNDING_SOURCE_LABEL, PAYMENT_STATUS, PAYROLL_STATUS } from "@/lib/constants";
import {
  formatDate,
  formatMoney,
  formatMonthYear,
  toDateInputValue,
} from "@/lib/format";
import { currentMonthKey, selectableMonths } from "@/lib/period";
import { getSystemStartDate } from "@/lib/settings";
import {
  AdvanceDeductionForm,
  LockForm,
  PayForm,
  RecalculateForm,
} from "./payroll-forms";
import {
  cancelSalaryPayment,
  lockPayroll,
  paySalary,
  recalculatePayroll,
  setAdvanceDeduction,
  unlockPayroll,
} from "./actions";

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  await requireUser();
  const user = await getCurrentUser();
  const canEdit = isSuperAdmin(user);

  const params = await searchParams;
  const fallback = currentMonthKey();
  const year = Number(params.year) || fallback.year;
  const month = Number(params.month) || fallback.month;

  const [systemStart, rows, period] = await Promise.all([
    getSystemStartDate(),
    buildPayrollRows(year, month),
    prisma.payrollPeriod.findUnique({ where: { year_month: { year, month } } }),
  ]);

  const months = selectableMonths(systemStart);
  const locked = period?.status === PAYROLL_STATUS.LOCKED;
  const hasLines = rows.some((row) => row.line !== null);

  const totals = rows.reduce(
    (acc, row) => {
      const net = row.line?.netSalary ?? row.computation.netSalary;
      acc.net += net;
      acc.advances += row.computation.advanceDeduction;
      acc.paid += row.line?.paymentStatus === PAYMENT_STATUS.PAID ? net : 0;
      return acc;
    },
    { net: 0, advances: 0, paid: 0 },
  );

  const missing = rows.filter((row) => row.summary.unrecordedDays > 0);
  const today = toDateInputValue(new Date());

  return (
    <>
      <PageHeader
        title="المرتبات"
        description="الحساب تلقائي من الحضور والحوافز والخصومات، واستقطاع السلفة يدوي"
        actions={
          <Link
            href={`/reports/payroll?year=${year}&month=${month}`}
            className={buttonSecondaryClass}
          >
            تقرير الشهر
          </Link>
        }
      />

      <Card className="mb-6">
        <MonthPicker
          year={year}
          month={month}
          months={months}
          extra={
            <span className="ms-auto flex items-center gap-2 text-sm text-slate-500">
              {formatMonthYear(year, month)}
              {locked ? (
                <Badge tone="warning">مقفول</Badge>
              ) : (
                <Badge tone="success">مفتوح</Badge>
              )}
            </span>
          }
        />
      </Card>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="عدد الموظفين" value={String(rows.length)} />
        <StatCard
          label="إجمالي صافي المرتبات"
          value={`${formatMoney(totals.net)} ج.م`}
          tone="brand"
        />
        <StatCard
          label="استقطاع السلف"
          value={`${formatMoney(totals.advances)} ج.م`}
        />
        <StatCard
          label="تم صرفه"
          value={`${formatMoney(totals.paid)} ج.م`}
          tone="positive"
        />
      </div>

      {missing.length > 0 ? (
        <div className="mb-6">
          <Alert>
            أيام حضور غير مسجلة (تُحتسب غيابًا وتمنع إقفال الشهر):{" "}
            {missing
              .slice(0, 6)
              .map((row) => `${row.employee.name} (${row.summary.unrecordedDays})`)
              .join("، ")}
            {missing.length > 6 ? " وغيرهم" : ""} —{" "}
            <Link href="/attendance" className="underline">
              سجّلها من شاشة الحضور
            </Link>
          </Alert>
        </div>
      ) : null}

      {canEdit ? (
        <Card className="mb-6">
          <div className="flex flex-wrap items-start gap-6">
            {!locked ? (
              <>
                <RecalculateForm
                  action={recalculatePayroll}
                  year={year}
                  month={month}
                />
                <LockForm action={lockPayroll} year={year} month={month} />
              </>
            ) : (
              <form action={unlockPayroll}>
                <input type="hidden" name="year" value={year} />
                <input type="hidden" name="month" value={month} />
                <button type="submit" className={buttonSecondaryClass}>
                  فتح الشهر للتعديل
                </button>
              </form>
            )}
          </div>
          <p className="mt-3 text-xs text-slate-400">
            إعادة الحساب لا تمس المرتبات المصروفة — لازم إلغاء الصرف أولًا عشان حركة
            الخزنة تفضل مظبوطة.
          </p>
        </Card>
      ) : null}

      <Card
        title={`مرتبات ${formatMonthYear(year, month)}`}
        description={
          hasLines
            ? "الأرقام المحفوظة بعد آخر عملية حساب"
            : "معاينة محسوبة — اضغط «حساب مرتبات الشهر» لحفظها"
        }
      >
        {rows.length === 0 ? (
          <EmptyState message="لا يوجد موظفون في هذا الشهر." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>الموظف</Th>
                <Th className="w-28">الأساسي المستحق</Th>
                <Th className="w-24">حوافز</Th>
                <Th className="w-24">جمعة</Th>
                <Th className="w-24">غياب</Th>
                <Th className="w-24">خصومات</Th>
                <Th className="w-40">استقطاع سلفة</Th>
                <Th className="w-28">الصافي</Th>
                <Th className="w-56">الصرف</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const isPaid = row.line?.paymentStatus === PAYMENT_STATUS.PAID;
                const net = row.line?.netSalary ?? row.computation.netSalary;

                return (
                  <tr key={row.employee.id} className="align-top">
                    <Td>
                      <Link
                        href={`/payroll/${row.employee.id}?year=${year}&month=${month}`}
                        className="font-medium text-blue-600 hover:underline"
                      >
                        {row.employee.name}
                      </Link>
                      <span className="mt-0.5 block text-xs text-slate-400">
                        {row.employee.jobTitle} — يوم ={" "}
                        {formatMoney(row.computation.dayValue)} ج.م
                      </span>
                      {row.computation.entitledDays < 30 ? (
                        <span className="mt-0.5 block text-xs text-amber-600">
                          استحقاق {row.computation.entitledDays} يوم (التحاق/ترك عمل
                          وسط الشهر)
                        </span>
                      ) : null}
                    </Td>
                    <Td className="num">
                      {formatMoney(row.computation.earnedBasicSalary)}
                    </Td>
                    <Td className="num text-emerald-700">
                      {formatMoney(
                        row.computation.incentivesTotal +
                          row.computation.unusedLeaveAmount,
                      )}
                    </Td>
                    <Td className="num text-emerald-700">
                      {formatMoney(row.computation.fridayEarnings)}
                      {row.summary.workedFridays > 0 ? (
                        <span className="block text-[11px] text-slate-400">
                          {row.summary.workedFridays} يوم
                        </span>
                      ) : null}
                    </Td>
                    <Td className="num text-rose-700">
                      {formatMoney(
                        row.computation.absenceDeduction +
                          row.computation.excessLeaveDeduction,
                      )}
                      {row.summary.absentDays + row.summary.excessLeaveDays > 0 ? (
                        <span className="block text-[11px] text-slate-400">
                          {row.summary.absentDays + row.summary.excessLeaveDays} يوم
                        </span>
                      ) : null}
                    </Td>
                    <Td className="num text-rose-700">
                      {formatMoney(row.computation.deductionsTotal)}
                    </Td>
                    <Td>
                      <div className="num text-rose-700">
                        {formatMoney(row.computation.advanceDeduction)}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        متبقي: {formatMoney(row.advanceRemaining)}
                      </div>
                      {canEdit && !locked && !isPaid && row.line ? (
                        <div className="mt-2">
                          <AdvanceDeductionForm
                            action={setAdvanceDeduction}
                            lineId={row.line.id}
                            current={row.line.advanceDeduction}
                            remaining={row.advanceRemaining}
                          />
                        </div>
                      ) : null}
                    </Td>
                    <Td className="num font-bold text-slate-900">
                      {formatMoney(net)}
                    </Td>
                    <Td>
                      {isPaid ? (
                        <div className="space-y-1">
                          <Badge tone="success">تم الصرف</Badge>
                          <div className="text-[11px] text-slate-500">
                            {formatDate(row.line?.paidAt)} —{" "}
                            {FUNDING_SOURCE_LABEL[row.line?.fundingSource ?? ""] ??
                              "—"}
                          </div>
                          {canEdit && !locked ? (
                            <form action={cancelSalaryPayment}>
                              <input
                                type="hidden"
                                name="lineId"
                                value={row.line?.id}
                              />
                              <button type="submit" className={buttonDangerClass}>
                                إلغاء الصرف
                              </button>
                            </form>
                          ) : null}
                        </div>
                      ) : !row.line ? (
                        <span className="text-xs text-slate-400">
                          لسه متحسبش — اضغط «حساب مرتبات الشهر»
                        </span>
                      ) : canEdit && !locked ? (
                        <PayForm
                          action={paySalary}
                          lineId={row.line.id}
                          defaultDate={today}
                        />
                      ) : (
                        <Badge tone="neutral">لم يتم الصرف</Badge>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
