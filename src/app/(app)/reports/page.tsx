import Link from "next/link";

import { requireUser } from "@/lib/auth";
import { Card, PageHeader, buttonSecondaryClass } from "@/components/ui";
import { toDateInputValue, startOfDay } from "@/lib/format";
import { currentMonthKey, monthStart } from "@/lib/period";

export default async function ReportsPage() {
  await requireUser();
  const { year, month } = currentMonthKey();
  const from = toDateInputValue(monthStart(year, month));
  const to = toDateInputValue(startOfDay(new Date()));

  const reports = [
    {
      title: "المرتبات",
      description:
        "مرتبات الشهر بكل بنودها: الأساسي، الحوافز، الخصومات، السلف، الصافي وحالة الصرف",
      href: `/reports/payroll?year=${year}&month=${month}`,
      excel: `/api/export?report=payroll&year=${year}&month=${month}`,
    },
    {
      title: "الحضور",
      description: "ملخص الحضور والغياب والإجازات لكل موظف في الشهر",
      href: `/reports/attendance?year=${year}&month=${month}`,
      excel: `/api/export?report=attendance&year=${year}&month=${month}`,
    },
    {
      title: "الخزنة",
      description:
        "التحصيلات والمصروفات والإقفال اليومي والمحسوب مقابل الفعلي والعجز/الزيادة",
      href: `/reports/cash?from=${from}&to=${to}`,
      excel: `/api/export?report=cash&from=${from}&to=${to}`,
    },
    {
      title: "الموظفون",
      description: "بيانات الموظفين وتاريخ المرتبات وإجمالي بدل المواصلات الأسبوعي",
      href: "/reports/employees",
      excel: "/api/export?report=employees",
    },
    {
      title: "السلف",
      description: "كل السلف وأرصدتها المتبقية على الموظفين",
      href: "/reports/advances",
      excel: "/api/export?report=advances",
    },
  ];

  return (
    <>
      <PageHeader
        title="التقارير"
        description="كل تقرير يُعرض داخل النظام، ويمكن طباعته PDF أو تنزيله Excel"
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {reports.map((report) => (
          <Card key={report.href} title={report.title}>
            <p className="mb-4 text-sm text-slate-500">{report.description}</p>
            <div className="flex flex-wrap items-center gap-2">
              <Link href={report.href} className={buttonSecondaryClass}>
                عرض التقرير
              </Link>
              <a href={report.excel} className={buttonSecondaryClass}>
                تنزيل Excel
              </a>
            </div>
          </Card>
        ))}
      </div>

      <p className="mt-6 text-xs text-slate-400">
        تصدير PDF يتم من زر «طباعة / حفظ PDF» داخل كل تقرير — اختر «حفظ كـPDF» في نافذة
        الطباعة.
      </p>
    </>
  );
}
