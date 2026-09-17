import { buttonSecondaryClass, inputClass } from "@/components/ui";
import { monthNameAr } from "@/lib/format";
import type { MonthKey } from "@/lib/period";

/** اختيار شهر المرتب — يُستخدم في المرتبات والحوافز والخصومات والتقارير */
export function MonthPicker({
  year,
  month,
  months,
  extra,
}: {
  year: number;
  month: number;
  months: MonthKey[];
  extra?: React.ReactNode;
}) {
  const years = Array.from(new Set(months.map((item) => item.year))).sort(
    (a, b) => b - a,
  );

  return (
    <form className="flex flex-wrap items-end gap-3">
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-slate-700">الشهر</span>
        <select name="month" defaultValue={month} className={inputClass}>
          {Array.from({ length: 12 }, (_, index) => index + 1).map((value) => (
            <option key={value} value={value}>
              {monthNameAr(value)}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-slate-700">السنة</span>
        <select name="year" defaultValue={year} className={inputClass}>
          {(years.length > 0 ? years : [year]).map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>

      <button type="submit" className={buttonSecondaryClass}>
        عرض
      </button>

      {extra}
    </form>
  );
}
