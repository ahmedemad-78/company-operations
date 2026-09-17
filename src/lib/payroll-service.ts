import "server-only";

import { prisma } from "@/lib/prisma";
import { advanceBalances } from "@/lib/advances";
import { INCENTIVE_KIND } from "@/lib/constants";
import {
  computePayroll,
  summarizeAttendance,
  type AttendanceSummary,
  type PayrollComputation,
} from "@/lib/payroll-engine";
import {
  dateKey,
  entitledDaysInMonth,
  monthEnd,
  monthStart,
  requiredAttendanceDates,
} from "@/lib/period";

/**
 * تجميع كل مدخلات المرتب لشهر واحد في مكان واحد:
 * الحضور + الحوافز + الخصومات + السلف + بيانات الموظف.
 * تُستخدم في شاشة المرتبات وفي التقارير حتى لا يتكرر الحساب في مكانين.
 */

export type PayrollRow = {
  employee: {
    id: string;
    name: string;
    jobTitle: string;
    basicSalary: number;
    monthlyPaidLeaveDays: number;
    startDate: Date;
    endDate: Date | null;
  };
  summary: AttendanceSummary;
  requiredDays: number;
  computation: PayrollComputation;
  incentiveNotes: string[];
  deductionNotes: string[];
  advanceRemaining: number;
  line: {
    id: string;
    paymentStatus: string;
    paidAt: Date | null;
    fundingSource: string | null;
    advanceDeduction: number;
    netSalary: number;
    note: string | null;
  } | null;
};

export async function buildPayrollRows(
  year: number,
  month: number,
): Promise<PayrollRow[]> {
  const from = monthStart(year, month);
  const to = monthEnd(year, month);

  const [employees, attendance, holidays, incentives, deductions, period, balances] =
    await Promise.all([
      prisma.employee.findMany({
        where: {
          deletedAt: null,
          startDate: { lte: to },
          OR: [{ endDate: null }, { endDate: { gte: from } }],
        },
        orderBy: { name: "asc" },
      }),
      prisma.attendance.findMany({
        where: { deletedAt: null, date: { gte: from, lte: to } },
      }),
      prisma.companyHoliday.findMany({
        where: { deletedAt: null, date: { gte: from, lte: to } },
      }),
      prisma.incentive.findMany({
        where: { deletedAt: null, year, month },
      }),
      prisma.deduction.findMany({
        where: { deletedAt: null, year, month },
      }),
      prisma.payrollPeriod.findUnique({ where: { year_month: { year, month } } }),
      advanceBalances(),
    ]);

  const lines = period
    ? await prisma.payrollLine.findMany({ where: { periodId: period.id } })
    : [];
  const lineByEmployee = new Map(lines.map((line) => [line.employeeId, line]));
  const holidayKeys = new Set(holidays.map((holiday) => dateKey(holiday.date)));

  return employees.map((employee) => {
    const employeeAttendance = attendance
      .filter((row) => row.employeeId === employee.id)
      .map((row) => ({
        date: row.date,
        status: row.status,
        workedFriday: row.workedFriday,
      }));

    const required = requiredAttendanceDates(employee, year, month, holidayKeys);
    const summary = summarizeAttendance({
      records: employeeAttendance,
      requiredDates: required,
      monthlyPaidLeaveDays: employee.monthlyPaidLeaveDays,
      holidayDaysInRange: holidays.length,
    });

    const employeeIncentives = incentives.filter(
      (row) => row.employeeId === employee.id,
    );
    const incentivesTotal = employeeIncentives
      .filter((row) => row.kind === INCENTIVE_KIND.INCENTIVE)
      .reduce((sum, row) => sum + row.amount, 0);
    const unusedLeaveAmount = employeeIncentives
      .filter((row) => row.kind === INCENTIVE_KIND.UNUSED_LEAVE)
      .reduce((sum, row) => sum + row.amount, 0);

    const employeeDeductions = deductions.filter(
      (row) => row.employeeId === employee.id,
    );
    const deductionsTotal = employeeDeductions.reduce(
      (sum, row) => sum + row.amount,
      0,
    );

    const line = lineByEmployee.get(employee.id) ?? null;
    const computation = computePayroll({
      basicSalary: employee.basicSalary,
      entitledDays: entitledDaysInMonth(employee, year, month),
      summary,
      incentivesTotal,
      unusedLeaveAmount,
      deductionsTotal,
      advanceDeduction: line?.advanceDeduction ?? 0,
    });

    return {
      employee: {
        id: employee.id,
        name: employee.name,
        jobTitle: employee.jobTitle,
        basicSalary: employee.basicSalary,
        monthlyPaidLeaveDays: employee.monthlyPaidLeaveDays,
        startDate: employee.startDate,
        endDate: employee.endDate,
      },
      summary,
      requiredDays: required.length,
      computation,
      incentiveNotes: employeeIncentives
        .map((row) => row.note)
        .filter((note): note is string => Boolean(note)),
      deductionNotes: employeeDeductions
        .map((row) => row.note)
        .filter((note): note is string => Boolean(note)),
      advanceRemaining: balances.get(employee.id)?.remaining ?? 0,
      line: line
        ? {
            id: line.id,
            paymentStatus: line.paymentStatus,
            paidAt: line.paidAt,
            fundingSource: line.fundingSource,
            advanceDeduction: line.advanceDeduction,
            netSalary: line.netSalary,
            note: line.note,
          }
        : null,
    };
  });
}

/** أيام الحضور الناقصة في الشهر — النظام يمنع إقفال المرتب قبل تسجيلها (قرار BRD رقم 17) */
export async function missingAttendanceDays(
  year: number,
  month: number,
): Promise<Array<{ employeeName: string; days: number }>> {
  const rows = await buildPayrollRows(year, month);
  return rows
    .filter((row) => row.summary.unrecordedDays > 0)
    .map((row) => ({
      employeeName: row.employee.name,
      days: row.summary.unrecordedDays,
    }));
}
