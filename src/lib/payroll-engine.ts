/**
 * محرك حساب المرتب — نقطة واحدة تُحسب فيها كل البنود، تستخدمها شاشة المرتبات والتقارير.
 *
 * معادلة صافي المرتب (BRD 6.3):
 *   المرتب الأساسي المستحق (بالتناسب عند الالتحاق/ترك العمل وسط الشهر)
 * + الحوافز + بدل الإجازة غير المستخدمة + مستحق أيام الجمعة المشتغلة
 * − خصم الغياب − خصم الإجازات الزائدة عن الاستحقاق − الخصومات − استقطاع السلفة
 */

import { ATTENDANCE_STATUS } from "@/lib/constants";
import { dayValue, hourValue } from "@/lib/payroll";
import { dateKey } from "@/lib/period";

export type AttendanceRecord = {
  date: Date;
  status: string;
  workedFriday: boolean;
};

export type AttendanceSummary = {
  presentDays: number;
  absentDays: number;
  leaveDays: number;
  excessLeaveDays: number;
  sickDays: number;
  holidayDays: number;
  workedFridays: number;
  /** أيام كان مطلوبًا تسجيلها ولم تُسجَّل — تُحتسب غيابًا (قرار BRD رقم 16) */
  unrecordedDays: number;
};

/**
 * تلخيص حضور موظف في شهر.
 * الأيام المطلوبة فقط هي التي تدخل في حساب الغياب؛ الجمعة والعطلات والأيام
 * خارج فترة العمل مستثناة أصلًا من `requiredDates` (قرار BRD رقم 29).
 */
export function summarizeAttendance({
  records,
  requiredDates,
  monthlyPaidLeaveDays,
  holidayDaysInRange,
}: {
  records: AttendanceRecord[];
  requiredDates: Date[];
  monthlyPaidLeaveDays: number;
  holidayDaysInRange: number;
}): AttendanceSummary {
  const byDate = new Map<string, AttendanceRecord>();
  for (const record of records) {
    byDate.set(dateKey(record.date), record);
  }

  let presentDays = 0;
  let absentDays = 0;
  let leaveDays = 0;
  let sickDays = 0;
  let unrecordedDays = 0;

  for (const date of requiredDates) {
    const record = byDate.get(dateKey(date));
    if (!record) {
      unrecordedDays += 1;
      absentDays += 1;
      continue;
    }
    if (record.status === ATTENDANCE_STATUS.PRESENT) presentDays += 1;
    else if (record.status === ATTENDANCE_STATUS.LEAVE) leaveDays += 1;
    else if (record.status === ATTENDANCE_STATUS.SICK) sickDays += 1;
    else absentDays += 1;
  }

  // العمل يوم الجمعة يُسجَّل بعلامة مستقلة، ويوم الجمعة نفسه ليس ضمن الأيام المطلوبة
  const workedFridays = records.filter((record) => record.workedFriday).length;

  const excessLeaveDays = Math.max(0, leaveDays - Math.max(0, monthlyPaidLeaveDays));

  return {
    presentDays,
    absentDays,
    leaveDays,
    excessLeaveDays,
    sickDays,
    holidayDays: holidayDaysInRange,
    workedFridays,
    unrecordedDays,
  };
}

export type PayrollComputation = {
  dayValue: number;
  hourValue: number;
  entitledDays: number;
  earnedBasicSalary: number;
  incentivesTotal: number;
  unusedLeaveAmount: number;
  fridayEarnings: number;
  absenceDeduction: number;
  excessLeaveDeduction: number;
  deductionsTotal: number;
  advanceDeduction: number;
  netSalary: number;
  /** صافي المرتب قبل استقطاع السلفة — الحد الأقصى المسموح استقطاعه هذا الشهر */
  netBeforeAdvance: number;
};

export function computePayroll({
  basicSalary,
  entitledDays,
  summary,
  incentivesTotal,
  unusedLeaveAmount,
  deductionsTotal,
  advanceDeduction,
}: {
  basicSalary: number;
  entitledDays: number;
  summary: AttendanceSummary;
  incentivesTotal: number;
  unusedLeaveAmount: number;
  deductionsTotal: number;
  advanceDeduction: number;
}): PayrollComputation {
  const perDay = dayValue(basicSalary);
  const perHour = hourValue(basicSalary);

  const earnedBasicSalary = perDay * entitledDays;
  const fridayEarnings = perDay * summary.workedFridays;
  const absenceDeduction = perDay * summary.absentDays;
  const excessLeaveDeduction = perDay * summary.excessLeaveDays;

  const netBeforeAdvance = Math.max(
    0,
    earnedBasicSalary +
      incentivesTotal +
      unusedLeaveAmount +
      fridayEarnings -
      absenceDeduction -
      excessLeaveDeduction -
      deductionsTotal,
  );

  // لا يجوز استقطاع أكثر من المستحق هذا الشهر؛ الباقي يفضل في رصيد السلفة (BRD 10)
  const appliedAdvance = Math.min(Math.max(0, advanceDeduction), netBeforeAdvance);

  return {
    dayValue: perDay,
    hourValue: perHour,
    entitledDays,
    earnedBasicSalary,
    incentivesTotal,
    unusedLeaveAmount,
    fridayEarnings,
    absenceDeduction,
    excessLeaveDeduction,
    deductionsTotal,
    advanceDeduction: appliedAdvance,
    netSalary: netBeforeAdvance - appliedAdvance,
    netBeforeAdvance,
  };
}
