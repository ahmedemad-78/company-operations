/**
 * حساب فترة المرتب وأيام الاستحقاق وأيام الحضور المطلوبة.
 *
 * قرارات BRD المطبقة هنا:
 *  - الفترة من 1 لآخر يوم في الشهر (6.1)، وقيمة اليوم على أساس 30 يومًا (قرار 1).
 *  - الجمعة والعطلات الرسمية والأيام خارج فترة عمل الموظف لا يُطلب فيها حضور (قرار 29).
 *  - الالتحاق أو ترك العمل وسط الشهر ⇒ المرتب بالتناسب (قرار 33).
 */

import { PAYROLL_DAYS_PER_MONTH } from "@/lib/constants";
import { addDays, daysInMonth, isFriday, startOfDay } from "@/lib/format";

export type MonthKey = { year: number; month: number };

export function currentMonthKey(): MonthKey {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export function monthStart(year: number, month: number): Date {
  return startOfDay(new Date(year, month - 1, 1));
}

export function monthEnd(year: number, month: number): Date {
  return startOfDay(new Date(year, month - 1, daysInMonth(year, month)));
}

/** كل أيام الشهر كتواريخ */
export function eachDayOfMonth(year: number, month: number): Date[] {
  const total = daysInMonth(year, month);
  const days: Date[] = [];
  for (let day = 1; day <= total; day += 1) {
    days.push(startOfDay(new Date(year, month - 1, day)));
  }
  return days;
}

export function eachDayBetween(from: Date, to: Date): Date[] {
  const days: Date[] = [];
  let cursor = startOfDay(from);
  const last = startOfDay(to);
  while (cursor.getTime() <= last.getTime()) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return days;
}

/** مفتاح ثابت للتاريخ يُستخدم في الـMaps: 2026-09-16 */
export function dateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export type EmploymentRange = {
  startDate: Date;
  /** آخر يوم عمل — null يعني ما زال على رأس العمل */
  endDate?: Date | null;
};

/**
 * تقاطع فترة عمل الموظف مع الشهر. null لو الموظف لم يكن على رأس العمل في هذا الشهر إطلاقًا.
 */
export function employmentRangeInMonth(
  employment: EmploymentRange,
  year: number,
  month: number,
): { from: Date; to: Date } | null {
  const first = monthStart(year, month);
  const last = monthEnd(year, month);
  const hiredAt = startOfDay(employment.startDate);
  const leftAt = employment.endDate ? startOfDay(employment.endDate) : null;

  const from = hiredAt.getTime() > first.getTime() ? hiredAt : first;
  const to = leftAt && leftAt.getTime() < last.getTime() ? leftAt : last;

  if (from.getTime() > to.getTime()) return null;
  return { from, to };
}

/**
 * أيام الاستحقاق في الشهر: 30 للشهر الكامل، وبالتناسب لو الموظف التحق أو ترك العمل وسطه.
 * (قرار BRD رقم 33 — الحساب على أساس شهر = 30 يومًا حتى يتسق مع قيمة اليوم)
 */
export function entitledDaysInMonth(
  employment: EmploymentRange,
  year: number,
  month: number,
): number {
  const range = employmentRangeInMonth(employment, year, month);
  if (!range) return 0;

  const calendarDays = daysInMonth(year, month);
  const workedCalendarDays = eachDayBetween(range.from, range.to).length;
  if (workedCalendarDays >= calendarDays) return PAYROLL_DAYS_PER_MONTH;

  return Math.min(
    PAYROLL_DAYS_PER_MONTH,
    Math.round((workedCalendarDays / calendarDays) * PAYROLL_DAYS_PER_MONTH),
  );
}

/**
 * الأيام التي يجب تسجيل حضور فيها لموظف في شهر معين:
 * كل أيام فترة عمله داخل الشهر، ما عدا الجمعة والعطلات الرسمية والأيام المستقبلية.
 */
export function requiredAttendanceDates(
  employment: EmploymentRange,
  year: number,
  month: number,
  holidayKeys: Set<string>,
  today: Date = new Date(),
): Date[] {
  const range = employmentRangeInMonth(employment, year, month);
  if (!range) return [];

  const lastAllowed = startOfDay(today);
  return eachDayBetween(range.from, range.to).filter((date) => {
    if (date.getTime() > lastAllowed.getTime()) return false;
    if (isFriday(date)) return false;
    return !holidayKeys.has(dateKey(date));
  });
}

/** هل يُطلب تسجيل حضور في هذا اليوم لهذا الموظف؟ */
export function isAttendanceRequired(
  date: Date,
  employment: EmploymentRange,
  holidayKeys: Set<string>,
): boolean {
  const day = startOfDay(date);
  if (isFriday(day)) return false;
  if (holidayKeys.has(dateKey(day))) return false;

  const hiredAt = startOfDay(employment.startDate);
  if (day.getTime() < hiredAt.getTime()) return false;

  if (employment.endDate) {
    const leftAt = startOfDay(employment.endDate);
    if (day.getTime() > leftAt.getTime()) return false;
  }
  return true;
}

/** قائمة الشهور المتاحة للاختيار في الشاشات — من تاريخ بداية النظام حتى الشهر الحالي */
export function selectableMonths(systemStart: Date, monthsAhead = 0): MonthKey[] {
  const start = startOfDay(systemStart);
  const now = new Date();
  const months: MonthKey[] = [];

  let year = start.getFullYear();
  let month = start.getMonth() + 1;
  const lastYear = now.getFullYear();
  const lastMonth = now.getMonth() + 1 + monthsAhead;

  while (year < lastYear || (year === lastYear && month <= lastMonth)) {
    months.push({ year, month });
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return months.reverse();
}
