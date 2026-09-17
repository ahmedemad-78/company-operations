import Link from "next/link";

import { requireUser } from "@/lib/auth";
import { buildPayrollRows } from "@/lib/payroll-service";
import { prisma } from "@/lib/prisma";
import { getCompanyInfo, getSystemStartDate } from "@/lib/settings";
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
import { MonthPicker } from "@/components/month-picker";
import { PrintButton } from "@/components/print-button";
import { ATTENDANCE_STATUS, ATTENDANCE_STATUS_LABEL } from "@/lib/constants";
import { formatDate, formatMonthYear } from "@/lib/format";
import { currentMonthKey, monthEnd, monthStart, selectableMonths } from "@/lib/period";
import { ReportHeader } from "../report-header";

export default async function AttendanceReportPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string; employee?: string }>;
}) {
  await requireUser();
  const params = await searchParams;
  const fallback = currentMonthKey();
  const year = Number(params.year) || fallback.year;
  const month = Number(params.month) || fallback.month;

  const from = monthStart(year, month);
  const to = monthEnd(year, month);

  const [rows, company, systemStart, holidays, records] = await Promise.all([
    buildPayrollRows(year, month),
    getCompanyInfo(),
    getSystemStartDate(),
    prisma.companyHoliday.findMany({
      where: { deletedAt: null, date: { gte: from, lte: to } },
      orderBy: { date: "asc" },
    }),
    prisma.attendance.findMany({
      where: {
        deletedAt: null,
        date: { gte: from, lte: to },
        status: { not: ATTENDANCE_STATUS.PRESENT },
      },
      include: { employee: { select: { name: true } } },
      orderBy: { date: "asc" },
    }),
  ]);

  return (
    <>
      <div className="no-print">
        <PageHeader
          title="تقرير الحضور"
          description="ملخص شهري لكل موظف + تفاصيل أيام الغياب والإجازات"
          actions={
            <div className="flex items-center gap-2">
              <Link href="/reports" className={buttonSecondaryClass}>
                كل التقارير
              </Link>
              <a
                href={`/api/export?report=attendance&year=${year}&month=${month}`}
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

      <div className="print-area space-y-6">
        <ReportHeader
          company={company}
          title="تقرير الحضور"
          period={formatMonthYear(year, month)}
        />

        <Card title="ملخص الشهر">
          {rows.length === 0 ? (
            <EmptyState message="لا يوجد موظفون في هذا الشهر." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>الموظف</Th>
                  <Th className="w-24">أيام مطلوبة</Th>
                  <Th className="w-20">حاضر</Th>
                  <Th className="w-20">غياب</Th>
                  <Th className="w-20">إجازة</Th>
                  <Th className="w-24">إجازة زائدة</Th>
                  <Th className="w-20">مرضي</Th>
                  <Th className="w-24">جمعة عمل</Th>
                  <Th className="w-24">غير مسجل</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.employee.id}>
                    <Td>{row.employee.name}</Td>
                    <Td className="num">{row.requiredDays}</Td>
                    <Td className="num">{row.summary.presentDays}</Td>
                    <Td className="num text-rose-700">{row.summary.absentDays}</Td>
                    <Td className="num">{row.summary.leaveDays}</Td>
                    <Td className="num text-amber-700">
                      {row.summary.excessLeaveDays}
                    </Td>
                    <Td className="num">{row.summary.sickDays}</Td>
                    <Td className="num text-brand-700">{row.summary.workedFridays}</Td>
                    <Td className="num text-slate-400">
                      {row.summary.unrecordedDays}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="أيام الغياب والإجازات">
            {records.length === 0 ? (
              <EmptyState message="كل الأيام المسجلة حضور." />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th className="w-28">التاريخ</Th>
                    <Th>الموظف</Th>
                    <Th className="w-24">الحالة</Th>
                    <Th>ملاحظة</Th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => (
                    <tr key={record.id}>
                      <Td className="num whitespace-nowrap">
                        {formatDate(record.date)}
                      </Td>
                      <Td>{record.employee.name}</Td>
                      <Td>
                        <Badge
                          tone={
                            record.status === ATTENDANCE_STATUS.ABSENT
                              ? "danger"
                              : "info"
                          }
                        >
                          {ATTENDANCE_STATUS_LABEL[record.status] ?? record.status}
                        </Badge>
                      </Td>
                      <Td className="text-xs text-slate-500">
                        {record.note || "—"}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>

          <Card title="العطلات الرسمية في الشهر">
            {holidays.length === 0 ? (
              <EmptyState message="لا توجد عطلات رسمية في هذا الشهر." />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th className="w-28">التاريخ</Th>
                    <Th>العطلة</Th>
                  </tr>
                </thead>
                <tbody>
                  {holidays.map((holiday) => (
                    <tr key={holiday.id}>
                      <Td className="num whitespace-nowrap">
                        {formatDate(holiday.date)}
                      </Td>
                      <Td>{holiday.name}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
            <p className="mt-3 text-xs text-slate-400">
              الجمعة عطلة أسبوعية ولا تُسجَّل في الحضور إلا لو الموظف اشتغل.
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
