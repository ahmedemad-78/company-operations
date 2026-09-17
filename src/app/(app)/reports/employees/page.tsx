import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
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
} from "@/components/ui";
import { PrintButton } from "@/components/print-button";
import { EMPLOYEE_STATUS, EMPLOYEE_STATUS_LABEL } from "@/lib/constants";
import { formatDate, formatMoney } from "@/lib/format";
import { dayValue, hourValue } from "@/lib/payroll";
import { ReportHeader } from "../report-header";

export default async function EmployeesReportPage() {
  await requireUser();

  const [company, employees, salaryChanges] = await Promise.all([
    getCompanyInfo(),
    prisma.employee.findMany({
      where: { deletedAt: null },
      orderBy: [{ status: "asc" }, { name: "asc" }],
    }),
    prisma.salaryChange.findMany({
      include: { employee: { select: { name: true } } },
      orderBy: { effectiveDate: "desc" },
      take: 100,
    }),
  ]);

  const active = employees.filter(
    (employee) => employee.status === EMPLOYEE_STATUS.ACTIVE,
  );
  const weeklyTransport = active.reduce(
    (sum, employee) => sum + employee.weeklyTransportAllowance,
    0,
  );
  const monthlySalaries = active.reduce(
    (sum, employee) => sum + employee.basicSalary,
    0,
  );

  return (
    <>
      <div className="no-print">
        <PageHeader
          title="تقرير الموظفين"
          description="البيانات الأساسية وتاريخ المرتبات وإجمالي بدل المواصلات"
          actions={
            <div className="flex items-center gap-2">
              <Link href="/reports" className={buttonSecondaryClass}>
                كل التقارير
              </Link>
              <a
                href="/api/export?report=employees"
                className={buttonSecondaryClass}
              >
                تنزيل Excel
              </a>
              <PrintButton />
            </div>
          }
        />
      </div>

      <div className="print-area space-y-6">
        <ReportHeader
          company={company}
          title="تقرير الموظفين"
          period={`عدد الموظفين على رأس العمل: ${active.length}`}
        />

        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="موظفون يعملون" value={String(active.length)} />
          <StatCard
            label="إجمالي المرتبات الأساسية"
            value={`${formatMoney(monthlySalaries)} ج.م`}
            hint="شهريًا"
          />
          <StatCard
            label="بدل المواصلات الأسبوعي المتوقع"
            value={`${formatMoney(weeklyTransport)} ج.م`}
            hint="مصروف شركة — خارج المرتبات"
          />
        </div>

        <Card title="بيانات الموظفين">
          {employees.length === 0 ? (
            <EmptyState message="لا يوجد موظفون مسجلون." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>الموظف</Th>
                  <Th>الوظيفة</Th>
                  <Th className="w-28">المرتب الأساسي</Th>
                  <Th className="w-24">قيمة اليوم</Th>
                  <Th className="w-24">قيمة الساعة</Th>
                  <Th className="w-28">بدل المواصلات</Th>
                  <Th className="w-28">بداية العمل</Th>
                  <Th className="w-28">آخر يوم عمل</Th>
                  <Th className="w-20">الحالة</Th>
                </tr>
              </thead>
              <tbody>
                {employees.map((employee) => (
                  <tr key={employee.id}>
                    <Td>{employee.name}</Td>
                    <Td>{employee.jobTitle}</Td>
                    <Td className="num">{formatMoney(employee.basicSalary)}</Td>
                    <Td className="num">{formatMoney(dayValue(employee.basicSalary))}</Td>
                    <Td className="num">
                      {formatMoney(hourValue(employee.basicSalary))}
                    </Td>
                    <Td className="num">
                      {formatMoney(employee.weeklyTransportAllowance)}
                    </Td>
                    <Td className="num whitespace-nowrap">
                      {formatDate(employee.startDate)}
                    </Td>
                    <Td className="num whitespace-nowrap">
                      {employee.endDate ? formatDate(employee.endDate) : "—"}
                    </Td>
                    <Td>
                      <Badge
                        tone={
                          employee.status === EMPLOYEE_STATUS.ACTIVE
                            ? "success"
                            : "neutral"
                        }
                      >
                        {EMPLOYEE_STATUS_LABEL[employee.status]}
                      </Badge>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <Card title="تاريخ تغييرات المرتبات">
          {salaryChanges.length === 0 ? (
            <EmptyState message="لا توجد تغييرات مرتبات مسجلة." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th className="w-32">تاريخ التطبيق</Th>
                  <Th>الموظف</Th>
                  <Th className="w-28">المرتب القديم</Th>
                  <Th className="w-28">المرتب الجديد</Th>
                  <Th className="w-28">الفرق</Th>
                </tr>
              </thead>
              <tbody>
                {salaryChanges.map((change) => (
                  <tr key={change.id}>
                    <Td className="num whitespace-nowrap">
                      {formatDate(change.effectiveDate)}
                    </Td>
                    <Td>{change.employee.name}</Td>
                    <Td className="num">{formatMoney(change.oldSalary)}</Td>
                    <Td className="num">{formatMoney(change.newSalary)}</Td>
                    <Td
                      className={`num ${
                        change.newSalary >= change.oldSalary
                          ? "text-emerald-700"
                          : "text-rose-700"
                      }`}
                    >
                      {formatMoney(change.newSalary - change.oldSalary)}
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
