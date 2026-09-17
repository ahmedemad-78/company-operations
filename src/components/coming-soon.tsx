import { Card, PageHeader } from "@/components/ui";

/** شاشة مؤقتة للأقسام المتفق عليها في الـBRD ولم يبدأ تنفيذها بعد */
export function ComingSoon({
  title,
  description,
  points,
}: {
  title: string;
  description: string;
  points: string[];
}) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <Card
        title="هذا القسم قيد التنفيذ"
        description="المتطلبات متفق عليها ومسجلة في ملف BRD.md"
      >
        <ul className="space-y-2 text-sm text-slate-700">
          {points.map((point) => (
            <li key={point}>• {point}</li>
          ))}
        </ul>
      </Card>
    </>
  );
}
