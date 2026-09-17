import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { getCurrentUser, isSuperAdmin } from "@/lib/auth";
import { dayFigures, openDaysUntilToday } from "@/lib/cash";
import { advanceBalances } from "@/lib/advances";
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
  buttonSecondaryClass,
} from "@/components/ui";
import {
  BEARING_MOVEMENT_TYPE,
  CASH_TYPE,
  EMPLOYEE_STATUS,
  PAYMENT_STATUS,
  PAYROLL_STATUS,
} from "@/lib/constants";
import {
  addDays,
  formatDate,
  formatMoney,
  formatMonthYear,
  startOfDay,
  toDateInputValue,
} from "@/lib/format";
import { currentMonthKey } from "@/lib/period";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const today = startOfDay(new Date());
  const { year, month } = currentMonthKey();

  const [
    activeEmployees,
    figures,
    openDays,
    balances,
    movements,
    period,
    recentTransactions,
  ] = await Promise.all([
    prisma.employee.count({
      where: { deletedAt: null, status: EMPLOYEE_STATUS.ACTIVE },
    }),
    dayFigures(today),
    openDaysUntilToday(5),
    advanceBalances(),
    prisma.bearingMovement.findMany({
      where: { deletedAt: null },
      select: { type: true, quantity: true },
    }),
    prisma.payrollPeriod.findUnique({
      where: { year_month: { year, month } },
      include: { lines: true },
    }),
    prisma.cashTransaction.findMany({
      where: { deletedAt: null, date: { gte: addDays(today, -7), lte: today } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 8,
    }),
  ]);

  const advanceBalanceTotal = Array.from(balances.values()).reduce(
    (sum, balance) => sum + balance.remaining,
    0,
  );
  const bearingsQuantity = movements.reduce(
    (total, movement) =>
      movement.type === BEARING_MOVEMENT_TYPE.OUT
        ? total - movement.quantity
        : total + movement.quantity,
    0,
  );

  const payrollLines = period?.lines ?? [];
  const unpaidLines = payrollLines.filter(
    (line) => line.paymentStatus === PAYMENT_STATUS.UNPAID,
  );
  const unpaidTotal = unpaidLines.reduce((sum, line) => sum + line.netSalary, 0);

  return (
    <>
      <PageHeader
        title={`أهلًا، ${user?.name ?? ""}`}
        description={`ملخص اليوم — ${formatDate(today)}`}
      />

      {openDays.length > 0 ? (
        <div className="mb-6">
          <Alert tone="info">
            أيام محتاجة إقفال:{" "}
            {openDays.map((date, index) => (
              <span key={date.toISOString()}>
                {index > 0 ? "، " : ""}
                <Link
                  href={`/closing?date=${toDateInputValue(date)}`}
                  className="underline"
                >
                  {formatDate(date)}
                </Link>
              </span>
            ))}
          </Alert>
        </div>
      ) : null}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="رصيد الخزنة الآن"
          value={`${formatMoney(figures.calculatedClosing)} ج.م`}
          tone="brand"
          hint={`أول اليوم: ${formatMoney(figures.openingBalance)} ج.م`}
        />
        <StatCard
          label="تحصيلات اليوم"
          value={`${formatMoney(figures.collectionsTotal)} ج.م`}
          tone="positive"
        />
        <StatCard
          label="مصروفات اليوم"
          value={`${formatMoney(figures.expensesTotal)} ج.م`}
          tone="negative"
        />
        <StatCard label="موظفون يعملون" value={String(activeEmployees)} />
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="سلف لم تُستقطع بعد"
          value={`${formatMoney(advanceBalanceTotal)} ج.م`}
          tone={advanceBalanceTotal > 0 ? "negative" : "neutral"}
        />
        <StatCard
          label={`مرتبات ${formatMonthYear(year, month)} لم تُصرف`}
          value={`${formatMoney(unpaidTotal)} ج.م`}
          hint={
            period
              ? period.status === PAYROLL_STATUS.LOCKED
                ? "الشهر مقفول"
                : `${unpaidLines.length} موظف`
              : "لم تُحسب بعد"
          }
        />
        <StatCard
          label="كمية الرومان بلي"
          value={formatMoney(bearingsQuantity)}
          hint="قطعة"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card
          title="آخر الحركات المالية"
          actions={
            <Link href="/cash" className={buttonSecondaryClass}>
              كل الحركات
            </Link>
          }
        >
          {recentTransactions.length === 0 ? (
            <EmptyState message="لا توجد حركات في آخر أسبوع." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th className="w-24">التاريخ</Th>
                  <Th>الجهة / الوصف</Th>
                  <Th className="w-24">المبلغ</Th>
                </tr>
              </thead>
              <tbody>
                {recentTransactions.map((row) => (
                  <tr key={row.id}>
                    <Td className="num whitespace-nowrap text-slate-500">
                      {formatDate(row.date)}
                    </Td>
                    <Td>
                      {row.counterparty}
                      <Badge
                        tone={row.type === CASH_TYPE.COLLECTION ? "success" : "danger"}
                      >
                        {row.type === CASH_TYPE.COLLECTION ? "تحصيل" : "مصروف"}
                      </Badge>
                    </Td>
                    <Td
                      className={`num ${
                        row.type === CASH_TYPE.COLLECTION
                          ? "text-emerald-700"
                          : "text-rose-700"
                      }`}
                    >
                      {formatMoney(row.amount)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <Card title="اختصارات سريعة">
          <div className="grid gap-2 sm:grid-cols-2">
            <Link href="/attendance" className={buttonSecondaryClass}>
              تسجيل حضور اليوم
            </Link>
            <Link href="/cash" className={buttonSecondaryClass}>
              تسجيل تحصيل / مصروف
            </Link>
            <Link href="/closing" className={buttonSecondaryClass}>
              إقفال اليوم
            </Link>
            <Link href="/payroll" className={buttonSecondaryClass}>
              مرتبات الشهر
            </Link>
            <Link href="/quotations" className={buttonSecondaryClass}>
              عرض سعر جديد
            </Link>
            <Link href="/reports" className={buttonSecondaryClass}>
              التقارير
            </Link>
          </div>

          {isSuperAdmin(user) ? (
            <p className="mt-4 text-xs text-slate-400">
              كل إضافة أو تعديل أو إلغاء في النظام مسجل في{" "}
              <Link href="/audit" className="underline">
                سجل التغييرات
              </Link>
              .
            </p>
          ) : (
            <p className="mt-4 text-xs text-slate-400">
              صلاحيتك مشاهدة وتصدير التقارير، ما عدا حركات الرومان بلي.
            </p>
          )}
        </Card>
      </div>
    </>
  );
}
