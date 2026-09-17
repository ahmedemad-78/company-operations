import Link from "next/link";

import { requireUser } from "@/lib/auth";
import { buildPayrollRows } from "@/lib/payroll-service";
import { getCompanyInfo, getSystemStartDate } from "@/lib/settings";
import {
  Card,
  EmptyState,
  PageHeader,
  Table,
  Td,
  Th,
  buttonSecondaryClass,
} from "@/components/ui";
import { MonthPicker } from "@/components/month-picker";
import { PrintButton } from "@/components/print-button";
import { FUNDING_SOURCE_LABEL, PAYMENT_STATUS_LABEL } from "@/lib/constants";
import { formatDate, formatMoney, formatMonthYear } from "@/lib/format";
import { currentMonthKey, selectableMonths } from "@/lib/period";
import { ReportHeader } from "../report-header";

export default async function PayrollReportPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  await requireUser();
  const params = await searchParams;
  const fallback = currentMonthKey();
  const year = Number(params.year) || fallback.year;
  const month = Number(params.month) || fallback.month;

  const [rows, company, systemStart] = await Promise.all([
    buildPayrollRows(year, month),
    getCompanyInfo(),
    getSystemStartDate(),
  ]);

  const totals = rows.reduce(
    (acc, row) => {
      acc.earned += row.computation.earnedBasicSalary;
      acc.incentives +=
        row.computation.incentivesTotal + row.computation.unusedLeaveAmount;
      acc.friday += row.computation.fridayEarnings;
      acc.absence +=
        row.computation.absenceDeduction + row.computation.excessLeaveDeduction;
      acc.deductions += row.computation.deductionsTotal;
      acc.advance += row.computation.advanceDeduction;
      acc.net += row.line?.netSalary ?? row.computation.netSalary;
      return acc;
    },
    {
      earned: 0,
      incentives: 0,
      friday: 0,
      absence: 0,
      deductions: 0,
      advance: 0,
      net: 0,
    },
  );

  return (
    <>
      <div className="no-print">
        <PageHeader
          title="تقرير المرتبات"
          description="كل الموظفين في شهر واحد بكل بنود المرتب"
          actions={
            <div className="flex items-center gap-2">
              <Link href="/reports" className={buttonSecondaryClass}>
                كل التقارير
              </Link>
              <a
                href={`/api/export?report=payroll&year=${year}&month=${month}`}
                className={buttonSecondaryClass}
              >
                تنزيل Excel
              </a>
              <PrintButton />
            </div>
          }
        />

        <Card className="mb-6">
          <MonthPicker
            year={year}
            month={month}
            months={selectableMonths(systemStart)}
          />
        </Card>
      </div>

      <div className="print-area">
        <ReportHeader
          company={company}
          title="تقرير المرتبات"
          period={formatMonthYear(year, month)}
        />

        <Card>
          {rows.length === 0 ? (
            <EmptyState message="لا يوجد موظفون في هذا الشهر." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>الموظف</Th>
                  <Th className="w-24">الأساسي</Th>
                  <Th className="w-24">المستحق</Th>
                  <Th className="w-24">حوافز</Th>
                  <Th className="w-24">جمعة</Th>
                  <Th className="w-24">غياب</Th>
                  <Th className="w-24">خصومات</Th>
                  <Th className="w-24">سلفة</Th>
                  <Th className="w-28">الصافي</Th>
                  <Th className="w-28">الصرف</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.employee.id}>
                    <Td>
                      {row.employee.name}
                      <span className="block text-[11px] text-slate-400">
                        {row.employee.jobTitle}
                      </span>
                    </Td>
                    <Td className="num">{formatMoney(row.employee.basicSalary)}</Td>
                    <Td className="num">
                      {formatMoney(row.computation.earnedBasicSalary)}
                    </Td>
                    <Td className="num">
                      {formatMoney(
                        row.computation.incentivesTotal +
                          row.computation.unusedLeaveAmount,
                      )}
                    </Td>
                    <Td className="num">
                      {formatMoney(row.computation.fridayEarnings)}
                    </Td>
                    <Td className="num">
                      {formatMoney(
                        row.computation.absenceDeduction +
                          row.computation.excessLeaveDeduction,
                      )}
                    </Td>
                    <Td className="num">
                      {formatMoney(row.computation.deductionsTotal)}
                    </Td>
                    <Td className="num">
                      {formatMoney(row.computation.advanceDeduction)}
                    </Td>
                    <Td className="num font-bold">
                      {formatMoney(row.line?.netSalary ?? row.computation.netSalary)}
                    </Td>
                    <Td className="text-xs">
                      {PAYMENT_STATUS_LABEL[row.line?.paymentStatus ?? "UNPAID"]}
                      {row.line?.paidAt ? (
                        <span className="block text-[11px] text-slate-400">
                          {formatDate(row.line.paidAt)} —{" "}
                          {FUNDING_SOURCE_LABEL[row.line.fundingSource ?? ""] ?? ""}
                        </span>
                      ) : null}
                    </Td>
                  </tr>
                ))}
                <tr className="bg-slate-50 font-bold">
                  <Td>الإجمالي</Td>
                  <Td />
                  <Td className="num">{formatMoney(totals.earned)}</Td>
                  <Td className="num">{formatMoney(totals.incentives)}</Td>
                  <Td className="num">{formatMoney(totals.friday)}</Td>
                  <Td className="num">{formatMoney(totals.absence)}</Td>
                  <Td className="num">{formatMoney(totals.deductions)}</Td>
                  <Td className="num">{formatMoney(totals.advance)}</Td>
                  <Td className="num">{formatMoney(totals.net)}</Td>
                  <Td />
                </tr>
              </tbody>
            </Table>
          )}
          <p className="mt-4 text-xs text-slate-400">
            بدل المواصلات مصروف شركة ولا يدخل في صافي المرتب.
          </p>
        </Card>
      </div>
    </>
  );
}
