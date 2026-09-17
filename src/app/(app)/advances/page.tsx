import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { getCurrentUser, isSuperAdmin, requireUser } from "@/lib/auth";
import { advanceBalances } from "@/lib/advances";
import {
  Badge,
  Card,
  EmptyState,
  PageHeader,
  StatCard,
  Table,
  Td,
  Th,
  buttonDangerClass,
} from "@/components/ui";
import { EMPLOYEE_STATUS, FUNDING_SOURCE, FUNDING_SOURCE_LABEL } from "@/lib/constants";
import { formatDate, formatMoney, toDateInputValue } from "@/lib/format";
import { AdvanceForm } from "./advance-form";
import { createAdvance, deleteAdvance } from "./actions";

export default async function AdvancesPage() {
  await requireUser();
  const user = await getCurrentUser();
  const canEdit = isSuperAdmin(user);

  const [employees, advances, balances] = await Promise.all([
    prisma.employee.findMany({
      where: { deletedAt: null, status: EMPLOYEE_STATUS.ACTIVE },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.advance.findMany({
      where: { deletedAt: null },
      include: { employee: { select: { id: true, name: true } } },
      orderBy: { date: "desc" },
      take: 200,
    }),
    advanceBalances(),
  ]);

  const totalRemaining = Array.from(balances.values()).reduce(
    (sum, balance) => sum + balance.remaining,
    0,
  );
  const totalAdvances = Array.from(balances.values()).reduce(
    (sum, balance) => sum + balance.total,
    0,
  );

  const employeesWithBalance = employees
    .map((employee) => ({
      employee,
      balance: balances.get(employee.id) ?? { total: 0, repaid: 0, remaining: 0 },
    }))
    .filter((row) => row.balance.total > 0);

  return (
    <>
      <PageHeader
        title="السلف"
        description="السلفة مصروف نقدي من الخزنة ورصيد على الموظف، والاستقطاع من المرتب يدوي كل شهر"
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="إجمالي السلف المسجلة"
          value={`${formatMoney(totalAdvances)} ج.م`}
        />
        <StatCard
          label="الرصيد المتبقي على الموظفين"
          value={`${formatMoney(totalRemaining)} ج.م`}
          tone={totalRemaining > 0 ? "negative" : "positive"}
        />
        <StatCard
          label="تم استقطاعه في المرتبات"
          value={`${formatMoney(totalAdvances - totalRemaining)} ج.م`}
          tone="positive"
        />
      </div>

      {canEdit ? (
        <Card title="تسجيل سلفة" className="mb-6">
          <AdvanceForm
            action={createAdvance}
            employees={employees}
            defaultDate={toDateInputValue(new Date())}
          />
        </Card>
      ) : null}

      <Card
        title="أرصدة السلف"
        description="الرصيد المتبقي يظهر تلقائيًا أمام المدير الإداري وقت عمل المرتب"
        className="mb-6"
      >
        {employeesWithBalance.length === 0 ? (
          <EmptyState message="لا توجد سلف مسجلة." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>الموظف</Th>
                <Th className="w-32">إجمالي السلف</Th>
                <Th className="w-32">المستقطع</Th>
                <Th className="w-32">المتبقي</Th>
              </tr>
            </thead>
            <tbody>
              {employeesWithBalance.map(({ employee, balance }) => (
                <tr key={employee.id}>
                  <Td>
                    <Link
                      href={`/employees/${employee.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      {employee.name}
                    </Link>
                  </Td>
                  <Td className="num">{formatMoney(balance.total)}</Td>
                  <Td className="num text-emerald-700">
                    {formatMoney(balance.repaid)}
                  </Td>
                  <Td className="num font-medium text-rose-700">
                    {formatMoney(balance.remaining)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Card title="حركات السلف">
        {advances.length === 0 ? (
          <EmptyState message="لا توجد سلف مسجلة بعد." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th className="w-28">التاريخ</Th>
                <Th>الموظف</Th>
                <Th className="w-28">المبلغ</Th>
                <Th className="w-40">مصدر الصرف</Th>
                <Th>ملاحظة</Th>
                {canEdit ? <Th className="w-24" /> : null}
              </tr>
            </thead>
            <tbody>
              {advances.map((advance) => (
                <tr key={advance.id}>
                  <Td className="num whitespace-nowrap">{formatDate(advance.date)}</Td>
                  <Td>{advance.employee.name}</Td>
                  <Td className="num">{formatMoney(advance.amount)}</Td>
                  <Td>
                    {advance.isOpeningBalance ? (
                      <Badge tone="neutral">رصيد افتتاحي</Badge>
                    ) : (
                      <Badge
                        tone={
                          advance.fundingSource === FUNDING_SOURCE.COMPANY_CASH
                            ? "neutral"
                            : "info"
                        }
                      >
                        {FUNDING_SOURCE_LABEL[advance.fundingSource] ??
                          advance.fundingSource}
                      </Badge>
                    )}
                  </Td>
                  <Td className="text-xs text-slate-500">{advance.note || "—"}</Td>
                  {canEdit ? (
                    <Td>
                      <form action={deleteAdvance}>
                        <input type="hidden" name="id" value={advance.id} />
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
    </>
  );
}
