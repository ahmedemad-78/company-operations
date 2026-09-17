import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { buildPayrollRows } from "@/lib/payroll-service";
import { advanceBalances } from "@/lib/advances";
import { buildWorkbook, downloadHeaders, type ExcelColumn } from "@/lib/excel";
import {
  ATTENDANCE_STATUS_LABEL,
  CASH_TYPE,
  CASH_TYPE_LABEL,
  CLOSING_STATUS,
  EMPLOYEE_STATUS,
  EMPLOYEE_STATUS_LABEL,
  FUNDING_SOURCE,
  FUNDING_SOURCE_LABEL,
  PAYMENT_STATUS_LABEL,
} from "@/lib/constants";
import { formatDate, formatMonthYear, startOfDay } from "@/lib/format";
import { currentMonthKey, monthEnd, monthStart } from "@/lib/period";

/**
 * تصدير التقارير Excel — متاح للمدير الإداري والمديرين (BRD 17).
 * الاستخدام: /api/export?report=payroll&year=2026&month=9
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const report = searchParams.get("report") ?? "";
  const fallback = currentMonthKey();
  const year = Number(searchParams.get("year")) || fallback.year;
  const month = Number(searchParams.get("month")) || fallback.month;

  try {
    switch (report) {
      case "payroll":
        return await exportPayroll(year, month);
      case "attendance":
        return await exportAttendance(year, month);
      case "employees":
        return await exportEmployees();
      case "advances":
        return await exportAdvances();
      case "cash":
        return await exportCash(
          searchParams.get("from"),
          searchParams.get("to"),
        );
      case "closing":
        return await exportClosing(
          searchParams.get("from"),
          searchParams.get("to"),
        );
      default:
        return NextResponse.json({ error: "تقرير غير معروف" }, { status: 400 });
    }
  } catch (error) {
    console.error("فشل تصدير التقرير:", error);
    return NextResponse.json({ error: "فشل تصدير التقرير" }, { status: 500 });
  }
}

function fileResponse(buffer: Buffer, fileName: string) {
  return new NextResponse(new Uint8Array(buffer), {
    headers: downloadHeaders(fileName),
  });
}

async function exportPayroll(year: number, month: number) {
  const rows = await buildPayrollRows(year, month);

  const columns: ExcelColumn[] = [
    { header: "الموظف", key: "name", width: 24 },
    { header: "الوظيفة", key: "jobTitle", width: 20 },
    { header: "المرتب الأساسي", key: "basicSalary", numeric: true },
    { header: "أيام الاستحقاق", key: "entitledDays", numeric: true, width: 14 },
    { header: "الأساسي المستحق", key: "earned", numeric: true },
    { header: "الحوافز", key: "incentives", numeric: true, width: 14 },
    { header: "بدل إجازة", key: "unusedLeave", numeric: true, width: 14 },
    { header: "مستحق الجمعة", key: "friday", numeric: true },
    { header: "خصم الغياب", key: "absence", numeric: true },
    { header: "خصم إجازة زائدة", key: "excessLeave", numeric: true, width: 16 },
    { header: "الخصومات", key: "deductions", numeric: true, width: 14 },
    { header: "استقطاع السلفة", key: "advance", numeric: true },
    { header: "صافي المرتب", key: "net", numeric: true },
    { header: "حالة الصرف", key: "status", width: 14 },
    { header: "تاريخ الصرف", key: "paidAt", width: 14 },
    { header: "مصدر الصرف", key: "fundingSource", width: 16 },
  ];

  const data = rows.map((row) => ({
    name: row.employee.name,
    jobTitle: row.employee.jobTitle,
    basicSalary: row.employee.basicSalary,
    entitledDays: row.computation.entitledDays,
    earned: row.computation.earnedBasicSalary,
    incentives: row.computation.incentivesTotal,
    unusedLeave: row.computation.unusedLeaveAmount,
    friday: row.computation.fridayEarnings,
    absence: row.computation.absenceDeduction,
    excessLeave: row.computation.excessLeaveDeduction,
    deductions: row.computation.deductionsTotal,
    advance: row.computation.advanceDeduction,
    net: row.line?.netSalary ?? row.computation.netSalary,
    status: PAYMENT_STATUS_LABEL[row.line?.paymentStatus ?? "UNPAID"] ?? "—",
    paidAt: row.line?.paidAt ? formatDate(row.line.paidAt) : "—",
    fundingSource: row.line?.fundingSource
      ? (FUNDING_SOURCE_LABEL[row.line.fundingSource] ?? "—")
      : "—",
  }));

  const sum = (key: keyof (typeof data)[number]) =>
    data.reduce((total, row) => total + (Number(row[key]) || 0), 0);

  const buffer = await buildWorkbook({
    title: `مرتبات ${formatMonthYear(year, month)}`,
    subtitle: `عدد الموظفين: ${data.length}`,
    columns,
    rows: data,
    totals: {
      name: "الإجمالي",
      earned: sum("earned"),
      incentives: sum("incentives"),
      unusedLeave: sum("unusedLeave"),
      friday: sum("friday"),
      absence: sum("absence"),
      excessLeave: sum("excessLeave"),
      deductions: sum("deductions"),
      advance: sum("advance"),
      net: sum("net"),
    },
    sheetName: "المرتبات",
  });

  return fileResponse(buffer, `مرتبات-${year}-${month}`);
}

async function exportAttendance(year: number, month: number) {
  const rows = await buildPayrollRows(year, month);
  const from = monthStart(year, month);
  const to = monthEnd(year, month);

  const records = await prisma.attendance.findMany({
    where: { deletedAt: null, date: { gte: from, lte: to } },
    include: { employee: { select: { name: true } } },
    orderBy: [{ date: "asc" }],
  });

  const summaryColumns: ExcelColumn[] = [
    { header: "الموظف", key: "name", width: 24 },
    { header: "أيام مطلوبة", key: "required", numeric: true },
    { header: "حاضر", key: "present", numeric: true, width: 12 },
    { header: "غياب", key: "absent", numeric: true, width: 12 },
    { header: "إجازة", key: "leave", numeric: true, width: 12 },
    { header: "إجازة زائدة", key: "excess", numeric: true },
    { header: "مرضي", key: "sick", numeric: true, width: 12 },
    { header: "عطلات رسمية", key: "holiday", numeric: true },
    { header: "جمعة عمل", key: "friday", numeric: true },
    { header: "غير مسجل", key: "unrecorded", numeric: true },
  ];

  const summaryRows = rows.map((row) => ({
    name: row.employee.name,
    required: row.requiredDays,
    present: row.summary.presentDays,
    absent: row.summary.absentDays,
    leave: row.summary.leaveDays,
    excess: row.summary.excessLeaveDays,
    sick: row.summary.sickDays,
    holiday: row.summary.holidayDays,
    friday: row.summary.workedFridays,
    unrecorded: row.summary.unrecordedDays,
  }));

  const buffer = await buildWorkbook({
    title: `ملخص الحضور — ${formatMonthYear(year, month)}`,
    subtitle: `عدد التسجيلات التفصيلية: ${records.length}`,
    columns: summaryColumns,
    rows: summaryRows,
    sheetName: "الحضور",
  });

  return fileResponse(buffer, `حضور-${year}-${month}`);
}

async function exportEmployees() {
  const employees = await prisma.employee.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
  });

  const columns: ExcelColumn[] = [
    { header: "الموظف", key: "name", width: 24 },
    { header: "الوظيفة", key: "jobTitle", width: 20 },
    { header: "المرتب الأساسي", key: "basicSalary", numeric: true },
    { header: "بدل المواصلات الأسبوعي", key: "transport", numeric: true, width: 22 },
    { header: "تاريخ بداية العمل", key: "startDate", width: 16 },
    { header: "آخر يوم عمل", key: "endDate", width: 16 },
    { header: "الحالة", key: "status", width: 12 },
  ];

  const rows = employees.map((employee) => ({
    name: employee.name,
    jobTitle: employee.jobTitle,
    basicSalary: employee.basicSalary,
    transport: employee.weeklyTransportAllowance,
    startDate: formatDate(employee.startDate),
    endDate: employee.endDate ? formatDate(employee.endDate) : "—",
    status: EMPLOYEE_STATUS_LABEL[employee.status] ?? employee.status,
  }));

  const activeTransport = employees
    .filter((employee) => employee.status === EMPLOYEE_STATUS.ACTIVE)
    .reduce((sum, employee) => sum + employee.weeklyTransportAllowance, 0);

  const buffer = await buildWorkbook({
    title: "بيانات الموظفين",
    subtitle: `إجمالي بدل المواصلات الأسبوعي للموظفين النشطين: ${activeTransport} ج.م`,
    columns,
    rows,
    totals: {
      name: "الإجمالي",
      basicSalary: employees.reduce((sum, e) => sum + e.basicSalary, 0),
      transport: employees.reduce((sum, e) => sum + e.weeklyTransportAllowance, 0),
    },
    sheetName: "الموظفون",
  });

  return fileResponse(buffer, "الموظفون");
}

async function exportAdvances() {
  const [advances, balances] = await Promise.all([
    prisma.advance.findMany({
      where: { deletedAt: null },
      include: { employee: { select: { id: true, name: true } } },
      orderBy: { date: "desc" },
    }),
    advanceBalances(),
  ]);

  const columns: ExcelColumn[] = [
    { header: "التاريخ", key: "date", width: 14 },
    { header: "الموظف", key: "name", width: 24 },
    { header: "المبلغ", key: "amount", numeric: true },
    { header: "مصدر الصرف", key: "fundingSource", width: 18 },
    { header: "الرصيد المتبقي للموظف", key: "remaining", numeric: true, width: 22 },
    { header: "ملاحظة", key: "note", width: 30 },
  ];

  const rows = advances.map((advance) => ({
    date: formatDate(advance.date),
    name: advance.employee.name,
    amount: advance.amount,
    fundingSource: advance.isOpeningBalance
      ? "رصيد افتتاحي"
      : (FUNDING_SOURCE_LABEL[advance.fundingSource] ?? advance.fundingSource),
    remaining: balances.get(advance.employee.id)?.remaining ?? 0,
    note: advance.note ?? "",
  }));

  const buffer = await buildWorkbook({
    title: "السلف وأرصدتها",
    columns,
    rows,
    totals: {
      date: "الإجمالي",
      amount: advances.reduce((sum, advance) => sum + advance.amount, 0),
    },
    sheetName: "السلف",
  });

  return fileResponse(buffer, "السلف");
}

async function exportCash(fromParam: string | null, toParam: string | null) {
  const to = startOfDay(toParam || new Date());
  const from = startOfDay(fromParam || monthStart(to.getFullYear(), to.getMonth() + 1));

  const transactions = await prisma.cashTransaction.findMany({
    where: { deletedAt: null, date: { gte: from, lte: to } },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
  });

  const columns: ExcelColumn[] = [
    { header: "التاريخ", key: "date", width: 14 },
    { header: "النوع", key: "type", width: 12 },
    { header: "الجهة / الوصف", key: "counterparty", width: 30 },
    { header: "المبلغ", key: "amount", numeric: true },
    { header: "مصدر الصرف", key: "fundingSource", width: 18 },
    { header: "ملاحظة", key: "note", width: 28 },
  ];

  const rows = transactions.map((row) => ({
    date: formatDate(row.date),
    type: CASH_TYPE_LABEL[row.type] ?? row.type,
    counterparty: row.counterparty,
    amount: row.amount,
    fundingSource: FUNDING_SOURCE_LABEL[row.fundingSource] ?? row.fundingSource,
    note: row.note ?? "",
  }));

  const collections = transactions
    .filter((row) => row.type === CASH_TYPE.COLLECTION)
    .reduce((sum, row) => sum + row.amount, 0);
  const expenses = transactions
    .filter(
      (row) =>
        row.type === CASH_TYPE.EXPENSE &&
        row.fundingSource === FUNDING_SOURCE.COMPANY_CASH,
    )
    .reduce((sum, row) => sum + row.amount, 0);

  const buffer = await buildWorkbook({
    title: "حركة الخزنة",
    subtitle: `من ${formatDate(from)} إلى ${formatDate(to)} — تحصيلات: ${collections} ج.م، مصروفات خزنة: ${expenses} ج.م`,
    columns,
    rows,
    sheetName: "الخزنة",
  });

  return fileResponse(buffer, "حركة-الخزنة");
}

async function exportClosing(fromParam: string | null, toParam: string | null) {
  const to = startOfDay(toParam || new Date());
  const from = startOfDay(fromParam || monthStart(to.getFullYear(), to.getMonth() + 1));

  const closings = await prisma.dailyClosing.findMany({
    where: { date: { gte: from, lte: to } },
    orderBy: { date: "asc" },
  });

  const columns: ExcelColumn[] = [
    { header: "اليوم", key: "date", width: 14 },
    { header: "رصيد أول اليوم", key: "opening", numeric: true },
    { header: "التحصيلات", key: "collections", numeric: true },
    { header: "المصروفات", key: "expenses", numeric: true },
    { header: "الرصيد المحسوب", key: "calculated", numeric: true },
    { header: "الرصيد الفعلي", key: "actual", numeric: true },
    { header: "الفرق", key: "difference", numeric: true },
    { header: "سبب الفرق", key: "note", width: 28 },
    { header: "الحالة", key: "status", width: 12 },
  ];

  const rows = closings.map((row) => ({
    date: formatDate(row.date),
    opening: row.openingBalance,
    collections: row.collectionsTotal,
    expenses: row.expensesTotal,
    calculated: row.calculatedClosing,
    actual: row.status === CLOSING_STATUS.CLOSED ? row.actualCash : "",
    difference: row.status === CLOSING_STATUS.CLOSED ? row.difference : "",
    note: row.differenceNote ?? "",
    status: row.status === CLOSING_STATUS.CLOSED ? "مقفول" : "مفتوح",
  }));

  const buffer = await buildWorkbook({
    title: "الإقفال اليومي",
    subtitle: `من ${formatDate(from)} إلى ${formatDate(to)}`,
    columns,
    rows,
    totals: {
      date: "الإجمالي",
      collections: closings.reduce((sum, row) => sum + row.collectionsTotal, 0),
      expenses: closings.reduce((sum, row) => sum + row.expensesTotal, 0),
      difference: closings
        .filter((row) => row.status === CLOSING_STATUS.CLOSED)
        .reduce((sum, row) => sum + row.difference, 0),
    },
    sheetName: "الإقفال",
  });

  return fileResponse(buffer, "الإقفال-اليومي");
}

// حالات الحضور تُستخدم في التصدير التفصيلي مستقبلًا
export const ATTENDANCE_LABELS = ATTENDANCE_STATUS_LABEL;
