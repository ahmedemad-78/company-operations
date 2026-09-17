import "server-only";

import { prisma } from "@/lib/prisma";

/**
 * رصيد السلف المتبقي لكل موظف = إجمالي السلف − إجمالي ما تم استقطاعه في المرتبات.
 * (قرار BRD رقم 8 — يُحسب ويُعرض تلقائيًا، والاستقطاع نفسه يدوي)
 */
export type AdvanceBalance = {
  total: number;
  repaid: number;
  remaining: number;
};

export async function advanceBalances(): Promise<Map<string, AdvanceBalance>> {
  const [advances, repayments] = await Promise.all([
    prisma.advance.groupBy({
      by: ["employeeId"],
      where: { deletedAt: null },
      _sum: { amount: true },
    }),
    prisma.payrollLine.groupBy({
      by: ["employeeId"],
      _sum: { advanceDeduction: true },
    }),
  ]);

  const repaidByEmployee = new Map(
    repayments.map((row) => [row.employeeId, row._sum.advanceDeduction ?? 0]),
  );

  const balances = new Map<string, AdvanceBalance>();
  for (const row of advances) {
    const total = row._sum.amount ?? 0;
    const repaid = repaidByEmployee.get(row.employeeId) ?? 0;
    balances.set(row.employeeId, {
      total,
      repaid,
      remaining: Math.max(0, total - repaid),
    });
  }

  // موظفون لهم استقطاعات بدون سلف مسجلة (حالة نادرة بعد إلغاء سلفة)
  for (const [employeeId, repaid] of repaidByEmployee) {
    if (!balances.has(employeeId)) {
      balances.set(employeeId, { total: 0, repaid, remaining: 0 });
    }
  }

  return balances;
}

export async function advanceBalanceFor(employeeId: string): Promise<AdvanceBalance> {
  const balances = await advanceBalances();
  return balances.get(employeeId) ?? { total: 0, repaid: 0, remaining: 0 };
}
