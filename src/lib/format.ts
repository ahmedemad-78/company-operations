/** تنسيق المبالغ والتواريخ — عربي، جنيه مصري، أرقام لاتينية بدون كسور (قرار BRD رقم 21) */

const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

export function formatMoney(value: number | null | undefined): string {
  return numberFormatter.format(Math.round(value ?? 0));
}

export function formatMoneyWithCurrency(value: number | null | undefined): string {
  return `${formatMoney(value)} ج.م`;
}

export function formatQuantity(value: number | null | undefined): string {
  const n = value ?? 0;
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)));
}

const WEEKDAYS_AR = [
  "الأحد",
  "الاثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
  "السبت",
];

const MONTHS_AR = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
];

export function monthNameAr(month: number): string {
  return MONTHS_AR[month - 1] ?? String(month);
}

export function weekdayNameAr(date: Date): string {
  return WEEKDAYS_AR[date.getDay()];
}

/** 2026-09-16 */
export function toDateInputValue(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** 16/09/2026 */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${d.getFullYear()}`;
}

/** الأربعاء 16/09/2026 */
export function formatDateWithWeekday(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return `${weekdayNameAr(d)} ${formatDate(d)}`;
}

/** 16/09/2026 - 11:45 م */
export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  let hours = d.getHours();
  const period = hours >= 12 ? "م" : "ص";
  hours = hours % 12 || 12;
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${formatDate(d)} - ${hours}:${minutes} ${period}`;
}

/** سبتمبر 2026 */
export function formatMonthYear(year: number, month: number): string {
  return `${monthNameAr(month)} ${year}`;
}

/** بداية اليوم بالتوقيت المحلي — كل تواريخ النظام تُخزَّن على منتصف الليل المحلي */
export function startOfDay(date: Date | string): Date {
  const d = typeof date === "string" ? new Date(`${date}T00:00:00`) : new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function isFriday(date: Date): boolean {
  return date.getDay() === 5;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}
