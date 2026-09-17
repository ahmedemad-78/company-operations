import { Card } from "@/components/ui";
import { formatDateTime } from "@/lib/format";

/** رأس ثابت لكل التقارير المطبوعة: بيانات الشركة + عنوان التقرير + الفترة */
export function ReportHeader({
  company,
  title,
  period,
}: {
  company: { name: string; address: string; phone: string };
  title: string;
  period: string;
}) {
  return (
    <Card className="mb-6">
      <div className="text-center">
        <p className="text-lg font-bold text-slate-900">{company.name}</p>
        {company.address ? (
          <p className="text-xs text-slate-500">{company.address}</p>
        ) : null}
        {company.phone ? (
          <p className="num text-xs text-slate-500">{company.phone}</p>
        ) : null}
        <p className="mt-3 font-semibold text-slate-800">{title}</p>
        <p className="text-sm text-slate-500">{period}</p>
        <p className="mt-1 text-[11px] text-slate-400">
          تاريخ الطباعة: {formatDateTime(new Date())}
        </p>
      </div>
    </Card>
  );
}
