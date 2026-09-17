"use client";

/** الطباعة تعتمد على محرك الطباعة/الـPDF المدمج في المتصفح — لا توجد مكتبة PDF في المشروع */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
    >
      طباعة / حفظ PDF
    </button>
  );
}
