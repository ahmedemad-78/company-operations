import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { getCurrentUser, isSuperAdmin, requireUser } from "@/lib/auth";
import {
  Alert,
  Badge,
  Card,
  EmptyState,
  PageHeader,
  Table,
  Td,
  Th,
  buttonDangerClass,
} from "@/components/ui";
import { MonthPicker } from "@/components/month-picker";
import {
  EMPLOYEE_STATUS,
  INCENTIVE_KIND,
  INCENTIVE_KIND_LABEL,
  PAYROLL_STATUS,
  VALUE_TYPE,
  VALUE_TYPE_LABEL,
} from "@/lib/constants";
import { formatMoney, formatMonthYear, formatQuantity } from "@/lib/format";
import { currentMonthKey, selectableMonths } from "@/lib/period";
import { getSystemStartDate } from "@/lib/settings";
import { AdjustmentForm } from "./adjustment-form";
import {
  createDeduction,
  createIncentive,
  deleteDeduction,
  deleteIncentive,
} from "./actions";

function valueLabel(valueType: string, quantity: number, amount: number) {
  if (valueType === VALUE_TYPE.AMOUNT) return `${formatMoney(amount)} ج.م`;
  return `${formatQuantity(quantity)} ${VALUE_TYPE_LABEL[valueType] ?? valueType} = ${formatMoney(amount)} ج.م`;
}

export default async function AdjustmentsPage({
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

  const systemStart = await getSystemStartDate();
  const months = selectableMonths(systemStart);

  const [employees, incentives, deductions, period] = await Promise.all([
    prisma.employee.findMany({
      where: { deletedAt: null, status: EMPLOYEE_STATUS.ACTIVE },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.incentive.findMany({
      where: { deletedAt: null, year, month },
      include: { employee: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.deduction.findMany({
      where: { deletedAt: null, year, month },
      include: { employee: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.payrollPeriod.findUnique({ where: { year_month: { year, month } } }),
  ]);

  const locked = period?.status === PAYROLL_STATUS.LOCKED;
  const editable = canEdit && !locked;
  const incentivesTotal = incentives.reduce((sum, row) => sum + row.amount, 0);
  const deductionsTotal = deductions.reduce((sum, row) => sum + row.amount, 0);

  return (
    <>
      <PageHeader
        title="الحوافز والخصومات"
        description="قيم متغيرة (مبلغ / أيام / ساعات) مرتبطة بشهر مرتب محدد، والنظام يحوّلها لمبلغ تلقائيًا"
      />

      <Card className="mb-6">
        <MonthPicker year={year} month={month} months={months} />
      </Card>

      {locked ? (
        <div className="mb-6">
          <Alert tone="info">
            مرتب {formatMonthYear(year, month)} مقفول — لا يمكن إضافة أو إلغاء أي بند.
            افتح الشهر أولًا من{" "}
            <Link href={`/payroll?year=${year}&month=${month}`} className="underline">
              شاشة المرتبات
            </Link>
            .
          </Alert>
        </div>
      ) : null}

      <div className="space-y-6">
        <Card
          title={`الحوافز — ${formatMonthYear(year, month)}`}
          description={`الإجمالي: ${formatMoney(incentivesTotal)} ج.م`}
        >
          {editable ? (
            <div className="mb-5">
              <AdjustmentForm
                action={createIncentive}
                employees={employees}
                year={year}
                month={month}
                submitLabel="إضافة حافز"
              />
            </div>
          ) : null}

          {incentives.length === 0 ? (
            <EmptyState message="لا توجد حوافز في هذا الشهر." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>الموظف</Th>
                  <Th className="w-32">النوع</Th>
                  <Th className="w-56">القيمة</Th>
                  <Th>ملاحظة</Th>
                  {editable ? <Th className="w-24" /> : null}
                </tr>
              </thead>
              <tbody>
                {incentives.map((row) => (
                  <tr key={row.id}>
                    <Td>{row.employee.name}</Td>
                    <Td>
                      <Badge
                        tone={
                          row.kind === INCENTIVE_KIND.UNUSED_LEAVE ? "info" : "success"
                        }
                      >
                        {INCENTIVE_KIND_LABEL[row.kind] ?? row.kind}
                      </Badge>
                    </Td>
                    <Td className="num">
                      {valueLabel(row.valueType, row.quantity, row.amount)}
                    </Td>
                    <Td className="text-xs text-slate-500">{row.note || "—"}</Td>
                    {editable ? (
                      <Td>
                        <form action={deleteIncentive}>
                          <input type="hidden" name="id" value={row.id} />
                          <button type="submit" className={buttonDangerClass}>
                            إلغاء
                          </button>
                        </form>
                      </Td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        {editable ? (
          <Card
            title="بدل الإجازة الشهرية غير المستخدمة"
            description="يُدخَل يدويًا بالكامل — النظام لا يحسبه تلقائيًا ولا يتابع رصيد إجازات"
          >
            <AdjustmentForm
              action={createIncentive}
              employees={employees}
              year={year}
              month={month}
              submitLabel="إضافة بدل إجازة"
              kind={INCENTIVE_KIND.UNUSED_LEAVE}
              allowDays={false}
            />
          </Card>
        ) : null}

        <Card
          title={`الخصومات — ${formatMonthYear(year, month)}`}
          description={`الإجمالي: ${formatMoney(deductionsTotal)} ج.م — خصم التأخير يُسجَّل هنا بعدد الساعات`}
        >
          {editable ? (
            <div className="mb-5">
              <AdjustmentForm
                action={createDeduction}
                employees={employees}
                year={year}
                month={month}
                submitLabel="إضافة خصم"
              />
            </div>
          ) : null}

          {deductions.length === 0 ? (
            <EmptyState message="لا توجد خصومات في هذا الشهر." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>الموظف</Th>
                  <Th className="w-56">القيمة</Th>
                  <Th>ملاحظة</Th>
                  {editable ? <Th className="w-24" /> : null}
                </tr>
              </thead>
              <tbody>
                {deductions.map((row) => (
                  <tr key={row.id}>
                    <Td>{row.employee.name}</Td>
                    <Td className="num">
                      {valueLabel(row.valueType, row.quantity, row.amount)}
                    </Td>
                    <Td className="text-xs text-slate-500">{row.note || "—"}</Td>
                    {editable ? (
                      <Td>
                        <form action={deleteDeduction}>
                          <input type="hidden" name="id" value={row.id} />
                          <button type="submit" className={buttonDangerClass}>
                            إلغاء
                          </button>
                        </form>
                      </Td>
                    ) : null}
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
