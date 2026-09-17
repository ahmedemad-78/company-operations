import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { getCurrentUser, isSuperAdmin } from "@/lib/auth";
import {
  Badge,
  Card,
  EmptyState,
  PageHeader,
  StatCard,
  Table,
  Td,
  Th,
  buttonClass,
  buttonSecondaryClass,
  inputClass,
} from "@/components/ui";
import { EMPLOYEE_STATUS, EMPLOYEE_STATUS_LABEL } from "@/lib/constants";
import { formatDate, formatMoney } from "@/lib/format";
import { dayValue } from "@/lib/payroll";

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { q, status } = await searchParams;
  const user = await getCurrentUser();
  const canEdit = isSuperAdmin(user);

  const employees = await prisma.employee.findMany({
    where: {
      deletedAt: null,
      ...(status === "ACTIVE" || status === "INACTIVE" ? { status } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q } },
              { jobTitle: { contains: q } },
            ],
          }
        : {}),
    },
    orderBy: [{ status: "asc" }, { name: "asc" }],
  });

  const activeEmployees = employees.filter(
    (e) => e.status === EMPLOYEE_STATUS.ACTIVE,
  );
  const totalBasic = activeEmployees.reduce((sum, e) => sum + e.basicSalary, 0);
  const totalTransport = activeEmployees.reduce(
    (sum, e) => sum + e.weeklyTransportAllowance,
    0,
  );

  return (
    <>
      <PageHeader
        title="الموظفون"
        description="بيانات الموظفين ومرتباتهم الأساسية وسجل تغييرات المرتب"
        actions={
          canEdit ? (
            <Link href="/employees/new" className={buttonClass}>
              إضافة موظف
            </Link>
          ) : null
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="موظفون يعملون" value={formatMoney(activeEmployees.length)} />
        <StatCard
          label="إجمالي المرتبات الأساسية"
          value={`${formatMoney(totalBasic)} ج.م`}
          hint="للموظفين الذين يعملون حاليًا"
          tone="brand"
        />
        <StatCard
          label="إجمالي بدل المواصلات الأسبوعي"
          value={`${formatMoney(totalTransport)} ج.م`}
          hint="مصروف شركة — خارج حساب المرتب"
        />
      </div>

      <Card>
        <form className="mb-4 flex flex-wrap items-end gap-3">
          <div className="min-w-48">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">
              بحث بالاسم أو الوظيفة
            </span>
            <input name="q" defaultValue={q ?? ""} className={inputClass} />
          </div>
          <div className="min-w-40">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">
              الحالة
            </span>
            <select name="status" defaultValue={status ?? ""} className={inputClass}>
              <option value="">الكل</option>
              <option value="ACTIVE">يعمل</option>
              <option value="INACTIVE">متوقف</option>
            </select>
          </div>
          <button type="submit" className={buttonSecondaryClass}>
            تطبيق
          </button>
        </form>

        {employees.length === 0 ? (
          <EmptyState message="لا يوجد موظفون مطابقون للبحث." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>الاسم</Th>
                <Th>الوظيفة</Th>
                <Th>المرتب الأساسي</Th>
                <Th>قيمة اليوم</Th>
                <Th>بدل المواصلات (أسبوعي)</Th>
                <Th>بداية العمل</Th>
                <Th>الحالة</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {employees.map((employee) => (
                <tr key={employee.id} className="hover:bg-slate-50">
                  <Td className="font-medium text-slate-900">{employee.name}</Td>
                  <Td>{employee.jobTitle}</Td>
                  <Td className="num">{formatMoney(employee.basicSalary)}</Td>
                  <Td className="num text-slate-500">
                    {formatMoney(dayValue(employee.basicSalary))}
                  </Td>
                  <Td className="num">
                    {formatMoney(employee.weeklyTransportAllowance)}
                  </Td>
                  <Td className="num">{formatDate(employee.startDate)}</Td>
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
                  <Td>
                    <Link
                      href={`/employees/${employee.id}`}
                      className="text-sm font-medium text-blue-600 hover:underline"
                    >
                      التفاصيل
                    </Link>
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
