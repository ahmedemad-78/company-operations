import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { openingBalanceFor } from "@/lib/cash";
import { getCompanyInfo } from "@/lib/settings";
import {
  Badge,
  Card,
  EmptyState,
  PageHeader,
  StatCard,
  Table,
  Td,
  Th,
  buttonSecondaryClass,
  inputClass,
} from "@/components/ui";
import { PrintButton } from "@/components/print-button";
import {
  CASH_ORIGIN_LABEL,
  CASH_TYPE,
  CLOSING_STATUS,
  FUNDING_SOURCE,
  FUNDING_SOURCE_LABEL,
} from "@/lib/constants";
import {
  addDays,
  formatDate,
  formatMoney,
  startOfDay,
  toDateInputValue,
} from "@/lib/format";
import { monthStart } from "@/lib/period";
import { ReportHeader } from "../report-header";

export default async function CashReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  await requireUser();
  const params = await searchParams;

  const today = startOfDay(new Date());
  const to = startOfDay(params.to || today);
  const from = startOfDay(
    params.from || monthStart(to.getFullYear(), to.getMonth() + 1),
  );

  const [company, transactions, closings, openingBalance] = await Promise.all([
    getCompanyInfo(),
    prisma.cashTransaction.findMany({
      where: { deletedAt: null, date: { gte: from, lte: to } },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    }),
    prisma.dailyClosing.findMany({
      where: { date: { gte: from, lte: to } },
      orderBy: { date: "asc" },
    }),
    openingBalanceFor(from),
  ]);

  const collections = transactions.filter((row) => row.type === CASH_TYPE.COLLECTION);
  const expenses = transactions.filter((row) => row.type === CASH_TYPE.EXPENSE);
  const companyExpenses = expenses.filter(
    (row) => row.fundingSource === FUNDING_SOURCE.COMPANY_CASH,
  );
  const managerExpenses = expenses.filter(
    (row) => row.fundingSource === FUNDING_SOURCE.MANAGER_PERSONAL,
  );

  const collectionsTotal = collections.reduce((sum, row) => sum + row.amount, 0);
  const companyExpensesTotal = companyExpenses.reduce(
    (sum, row) => sum + row.amount,
    0,
  );
  const managerExpensesTotal = managerExpenses.reduce(
    (sum, row) => sum + row.amount,
    0,
  );
  const closingBalance = openingBalance + collectionsTotal - companyExpensesTotal;

  const closedDays = closings.filter((row) => row.status === CLOSING_STATUS.CLOSED);
  const shortage = closedDays
    .filter((row) => row.difference < 0)
    .reduce((sum, row) => sum + Math.abs(row.difference), 0);
  const surplus = closedDays
    .filter((row) => row.difference > 0)
    .reduce((sum, row) => sum + row.difference, 0);

  const periodLabel = `من ${formatDate(from)} إلى ${formatDate(to)}`;

  return (
    <>
      <div className="no-print">
        <PageHeader
          title="تقرير الخزنة"
          description="حركة النقدية والإقفال اليومي والمحسوب مقابل الفعلي"
          actions={
            <div className="flex items-center gap-2">
              <Link href="/reports" className={buttonSecondaryClass}>
                كل التقارير
              </Link>
              <a
                href={`/api/export?report=cash&from=${toDateInputValue(from)}&to=${toDateInputValue(to)}`}
                className={buttonSecondaryClass}
              >
                Excel: الحركات
              </a>
              <a
                href={`/api/export?report=closing&from=${toDateInputValue(from)}&to=${toDateInputValue(to)}`}
                className={buttonSecondaryClass}
              >
                Excel: الإقفال
              </a>
              <PrintButton />
            </div>
          }
        />

        <Card className="mb-6">
          <form className="flex flex-wrap items-end gap-3">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">
                من
              </span>
              <input
                name="from"
                type="date"
                defaultValue={toDateInputValue(from)}
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">
                إلى
              </span>
              <input
                name="to"
                type="date"
                defaultValue={toDateInputValue(to)}
                className={inputClass}
              />
            </label>
            <button type="submit" className={buttonSecondaryClass}>
              عرض
            </button>
            <Link
              href={`/reports/cash?from=${toDateInputValue(addDays(today, -30))}&to=${toDateInputValue(today)}`}
              className={buttonSecondaryClass}
            >
              آخر 30 يوم
            </Link>
          </form>
        </Card>
      </div>

      <div className="print-area space-y-6">
        <ReportHeader
          company={company}
          title="تقرير الخزنة"
          period={periodLabel}
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="رصيد بداية الفترة"
            value={`${formatMoney(openingBalance)} ج.م`}
          />
          <StatCard
            label="إجمالي التحصيلات"
            value={`${formatMoney(collectionsTotal)} ج.م`}
            tone="positive"
          />
          <StatCard
            label="مصروفات خزنة الشركة"
            value={`${formatMoney(companyExpensesTotal)} ج.م`}
            tone="negative"
          />
          <StatCard
            label="رصيد نهاية الفترة"
            value={`${formatMoney(closingBalance)} ج.م`}
            tone="brand"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label="صرفه المدير من ماله الخاص"
            value={`${formatMoney(managerExpensesTotal)} ج.م`}
            hint="خارج رصيد الخزنة"
          />
          <StatCard
            label="إجمالي العجز"
            value={`${formatMoney(shortage)} ج.م`}
            tone={shortage > 0 ? "negative" : "neutral"}
          />
          <StatCard
            label="إجمالي الزيادة"
            value={`${formatMoney(surplus)} ج.م`}
            tone={surplus > 0 ? "positive" : "neutral"}
          />
        </div>

        <Card title="الإقفال اليومي">
          {closings.length === 0 ? (
            <EmptyState message="لا توجد إقفالات في هذه الفترة." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th className="w-28">اليوم</Th>
                  <Th className="w-28">أول اليوم</Th>
                  <Th className="w-28">تحصيلات</Th>
                  <Th className="w-28">مصروفات</Th>
                  <Th className="w-28">المحسوب</Th>
                  <Th className="w-28">الفعلي</Th>
                  <Th className="w-28">الفرق</Th>
                  <Th>سبب الفرق</Th>
                </tr>
              </thead>
              <tbody>
                {closings.map((row) => (
                  <tr key={row.id}>
                    <Td className="num whitespace-nowrap">{formatDate(row.date)}</Td>
                    <Td className="num">{formatMoney(row.openingBalance)}</Td>
                    <Td className="num text-emerald-700">
                      {formatMoney(row.collectionsTotal)}
                    </Td>
                    <Td className="num text-rose-700">
                      {formatMoney(row.expensesTotal)}
                    </Td>
                    <Td className="num">{formatMoney(row.calculatedClosing)}</Td>
                    <Td className="num">
                      {row.status === CLOSING_STATUS.CLOSED
                        ? formatMoney(row.actualCash)
                        : "—"}
                    </Td>
                    <Td className="num">
                      {row.status === CLOSING_STATUS.CLOSED ? (
                        row.difference === 0 ? (
                          <span className="text-emerald-600">0</span>
                        ) : row.difference < 0 ? (
                          <span className="text-rose-600">
                            عجز {formatMoney(Math.abs(row.difference))}
                          </span>
                        ) : (
                          <span className="text-amber-600">
                            زيادة {formatMoney(row.difference)}
                          </span>
                        )
                      ) : (
                        "—"
                      )}
                    </Td>
                    <Td className="text-xs text-slate-500">
                      {row.differenceNote || "—"}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <Card title={`الحركات (${transactions.length})`}>
          {transactions.length === 0 ? (
            <EmptyState message="لا توجد حركات في هذه الفترة." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th className="w-28">التاريخ</Th>
                  <Th className="w-20">النوع</Th>
                  <Th>الجهة / الوصف</Th>
                  <Th className="w-28">المبلغ</Th>
                  <Th className="w-36">مصدر الصرف</Th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((row) => (
                  <tr key={row.id}>
                    <Td className="num whitespace-nowrap">{formatDate(row.date)}</Td>
                    <Td>
                      <Badge
                        tone={row.type === CASH_TYPE.COLLECTION ? "success" : "danger"}
                      >
                        {row.type === CASH_TYPE.COLLECTION ? "تحصيل" : "مصروف"}
                      </Badge>
                    </Td>
                    <Td>
                      {row.counterparty}
                      {row.origin !== "MANUAL" ? (
                        <span className="block text-[11px] text-slate-400">
                          {CASH_ORIGIN_LABEL[row.origin] ?? row.origin}
                        </span>
                      ) : null}
                    </Td>
                    <Td className="num">{formatMoney(row.amount)}</Td>
                    <Td className="text-xs">
                      {row.type === CASH_TYPE.EXPENSE
                        ? (FUNDING_SOURCE_LABEL[row.fundingSource] ??
                          row.fundingSource)
                        : "—"}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}
