import Link from "next/link";
import { notFound } from "next/navigation";

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
  buttonSecondaryClass,
} from "@/components/ui";
import {
  DEFAULT_WORK_END,
  DEFAULT_WORK_START,
  EMPLOYEE_STATUS,
  EMPLOYEE_STATUS_LABEL,
} from "@/lib/constants";
import { formatDate, formatMoney, toDateInputValue } from "@/lib/format";
import { dayValue, hourValue } from "@/lib/payroll";
import { SalaryChangeForm } from "./salary-change-form";
import { EmployeeDangerActions } from "./danger-actions";

export default async function EmployeeDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  const canEdit = isSuperAdmin(user);

  const employee = await prisma.employee.findFirst({
    where: { id, deletedAt: null },
    include: {
      salaryChanges: { orderBy: { effectiveDate: "desc" } },
      advances: { where: { deletedAt: null } },
      payrollLines: { select: { advanceDeduction: true } },
    },
  });

  if (!employee) notFound();

  const totalAdvances = employee.advances.reduce((sum, a) => sum + a.amount, 0);
  const totalRepaid = employee.payrollLines.reduce(
    (sum, line) => sum + line.advanceDeduction,
    0,
  );
  const advanceBalance = totalAdvances - totalRepaid;

  return (
    <>
      <PageHeader
        title={employee.name}
        description={employee.jobTitle}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/employees" className={buttonSecondaryClass}>
              رجوع للقائمة
            </Link>
            {canEdit ? (
              <Link
                href={`/employees/${employee.id}/edit`}
                className={buttonSecondaryClass}
              >
                تعديل البيانات
              </Link>
            ) : null}
          </div>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="المرتب الأساسي"
          value={`${formatMoney(employee.basicSalary)} ج.م`}
          tone="brand"
        />
        <StatCard
          label="قيمة اليوم"
          value={`${formatMoney(dayValue(employee.basicSalary))} ج.م`}
          hint="الأساسي ÷ 30"
        />
        <StatCard
          label="قيمة الساعة"
          value={`${formatMoney(hourValue(employee.basicSalary))} ج.م`}
          hint="قيمة اليوم ÷ 10"
        />
        <StatCard
          label="رصيد السلف المتبقي"
          value={`${formatMoney(advanceBalance)} ج.م`}
          tone={advanceBalance > 0 ? "negative" : "neutral"}
          hint="إجمالي السلف − المستقطع"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="بيانات الموظف">
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-slate-500">الحالة</dt>
              <dd className="mt-1">
                <Badge
                  tone={
                    employee.status === EMPLOYEE_STATUS.ACTIVE
                      ? "success"
                      : "neutral"
                  }
                >
                  {EMPLOYEE_STATUS_LABEL[employee.status]}
                </Badge>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">تاريخ بداية العمل</dt>
              <dd className="mt-1 num text-sm text-slate-800">
                {formatDate(employee.startDate)}
              </dd>
            </div>
            {employee.endDate ? (
              <div>
                <dt className="text-xs text-slate-500">آخر يوم عمل</dt>
                <dd className="mt-1 num text-sm text-slate-800">
                  {formatDate(employee.endDate)}
                </dd>
                <p className="mt-1 text-xs text-slate-400">
                  المرتب يُحسب بالتناسب حتى هذا اليوم
                </p>
              </div>
            ) : null}
            <div>
              <dt className="text-xs text-slate-500">مواعيد العمل</dt>
              <dd className="mt-1 text-sm text-slate-800">
                {employee.hasFixedSchedule
                  ? `${DEFAULT_WORK_START} → ${DEFAULT_WORK_END}`
                  : "غير ثابتة"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">أيام الإجازة المدفوعة شهريًا</dt>
              <dd className="mt-1 num text-sm text-slate-800">
                {employee.monthlyPaidLeaveDays}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">بدل المواصلات الأسبوعي</dt>
              <dd className="mt-1 num text-sm text-slate-800">
                {formatMoney(employee.weeklyTransportAllowance)} ج.م
              </dd>
              <p className="mt-1 text-xs text-slate-400">
                مصروف شركة، خارج حساب المرتب
              </p>
            </div>
            <div>
              <dt className="text-xs text-slate-500">ملاحظات</dt>
              <dd className="mt-1 text-sm text-slate-800">
                {employee.note || "—"}
              </dd>
            </div>
          </dl>
        </Card>

        <Card
          title="سجل المرتبات"
          description="كل تغيير في المرتب الأساسي يُحفظ هنا ولا يُحذف"
        >
          {employee.salaryChanges.length === 0 ? (
            <EmptyState message="لا يوجد أي تغيير في المرتب حتى الآن." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>المرتب القديم</Th>
                  <Th>المرتب الجديد</Th>
                  <Th>تاريخ التطبيق</Th>
                </tr>
              </thead>
              <tbody>
                {employee.salaryChanges.map((change) => (
                  <tr key={change.id}>
                    <Td className="num text-slate-500">
                      {formatMoney(change.oldSalary)}
                    </Td>
                    <Td className="num font-medium text-slate-900">
                      {formatMoney(change.newSalary)}
                    </Td>
                    <Td className="num">{formatDate(change.effectiveDate)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        {canEdit ? (
          <Card
            title="تغيير المرتب"
            description="النظام يحتفظ بالمرتب القديم والجديد وتاريخ التطبيق"
          >
            <SalaryChangeForm
              employeeId={employee.id}
              currentSalary={employee.basicSalary}
              today={toDateInputValue(new Date())}
            />
          </Card>
        ) : null}

        {canEdit ? (
          <Card title="إجراءات" description="الإلغاء لا يمسح البيانات نهائيًا">
            <EmployeeDangerActions
              employeeId={employee.id}
              isActive={employee.status === EMPLOYEE_STATUS.ACTIVE}
            />
          </Card>
        ) : null}
      </div>
    </>
  );
}
