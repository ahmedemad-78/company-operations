import {
  PAYROLL_DAYS_PER_MONTH,
  PAYROLL_HOURS_PER_DAY,
  VALUE_TYPE,
} from "@/lib/constants";

/**
 * ثوابت حساب المرتب (قرارات BRD 1 و 2):
 *   قيمة اليوم  = المرتب الأساسي ÷ 30
 *   قيمة الساعة = قيمة اليوم ÷ 10
 * كل القيم تُقرَّب لأقرب جنيه لأن النظام لا يتعامل مع الكسور.
 */

export function dayValue(basicSalary: number): number {
  return Math.round(basicSalary / PAYROLL_DAYS_PER_MONTH);
}

export function hourValue(basicSalary: number): number {
  return Math.round(dayValue(basicSalary) / PAYROLL_HOURS_PER_DAY);
}

/** تحويل حافز أو خصم (مبلغ / أيام / ساعات) إلى قيمة بالجنيه */
export function resolveAmount(
  valueType: string,
  quantity: number,
  amount: number,
  basicSalary: number,
): number {
  if (valueType === VALUE_TYPE.AMOUNT) return Math.round(amount);
  if (valueType === VALUE_TYPE.DAYS) {
    return Math.round(dayValue(basicSalary) * quantity);
  }
  if (valueType === VALUE_TYPE.HOURS) {
    return Math.round(hourValue(basicSalary) * quantity);
  }
  return 0;
}
