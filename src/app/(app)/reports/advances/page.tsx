import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { advanceBalances } from "@/lib/advances";
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
import { FUNDING_SOURCE_LABEL } from "@/lib/constants";
import { formatDate, formatMoney } from "@/lib/format";
import { ReportHeader } from "../report-header";

export default async function AdvancesReportPage() {
  await requireUser();

  const [company, advances, balances, employees] = await Promise.all([
    getCompanyInfo(),
    prisma.advance.findMany({
      where: { deletedAt: null },
      include: { employee: { select: { id: true, name: true } } },
      orderBy: { date: "desc" },
    }),
    advanceBalances(),
    prisma.employee.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const totalAdvances = advances.reduce((sum, row) => sum + row.amount, 0);
  const totalRemaining = Array.from(balances.values()).reduce(
    (sum, balance) => sum + balance.remaining,
    0,
  );

  return (
    <>
      <div className="no-print">
        <PageHeader
          title="تقرير السلف"
          description="كل السلف وأرصدتها المتبقية"
          actions={
            <div className="flex items-center gap-2">
              <Link href="/reports" className={buttonSecondaryClass}>
                كل التقارير
              </Link>
              <a href="/api/export?report=advances" className={buttonSecondaryClass}>
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
          title="تقرير السلف"
          period={`عدد السلف: ${advances.length}`}
        />

        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label="إجمالي السلف"
            value={`${formatMoney(totalAdvances)} ج.م`}
          />
          <StatCard
            label="المستقطع في المرتبات"
            value={`${formatMoney(totalAdvances - totalRemaining)} ج.م`}
            tone="positive"
          />
          <StatCard
            label="المتبقي على الموظفين"
            value={`${formatMoney(totalRemaining)} ج.م`}
            tone={totalRemaining > 0 ? "negative" : "neutral"}
          />
        </div>

        <Card title="أرصدة الموظفين">
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
              {employees.map((employee) => {
                const balance = balances.get(employee.id);
                if (!balance || balance.total === 0) return null;
                return (
                  <tr key={employee.id}>
                    <Td>{employee.name}</Td>
                    <Td className="num">{formatMoney(balance.total)}</Td>
                    <Td className="num text-emerald-700">
                      {formatMoney(balance.repaid)}
                    </Td>
                    <Td className="num font-medium text-rose-700">
                      {formatMoney(balance.remaining)}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>

        <Card title="حركات السلف">
          {advances.length === 0 ? (
            <EmptyState message="لا توجد سلف مسجلة." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th className="w-28">التاريخ</Th>
                  <Th>الموظف</Th>
                  <Th className="w-28">المبلغ</Th>
                  <Th className="w-36">مصدر الصرف</Th>
                  <Th>ملاحظة</Th>
                </tr>
              </thead>
              <tbody>
                {advances.map((advance) => (
                  <tr key={advance.id}>
                    <Td className="num whitespace-nowrap">
                      {formatDate(advance.date)}
                    </Td>
                    <Td>{advance.employee.name}</Td>
                    <Td className="num">{formatMoney(advance.amount)}</Td>
                    <Td>
                      {advance.isOpeningBalance ? (
                        <Badge tone="neutral">رصيد افتتاحي</Badge>
                      ) : (
                        (FUNDING_SOURCE_LABEL[advance.fundingSource] ??
                        advance.fundingSource)
                      )}
                    </Td>
                    <Td className="text-xs text-slate-500">{advance.note || "—"}</Td>
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
