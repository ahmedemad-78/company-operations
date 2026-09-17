"use client";

import { buttonSecondaryClass } from "@/components/ui";

/**
 * تصدير PDF يتم عبر طباعة المتصفح (حفظ كـPDF) — أضمن طريقة لعرض العربي بشكل صحيح
 * بدون مكتبات إضافية. عناصر `.no-print` تختفي عند الطباعة (انظر globals.css).
 */
export function PrintButton({ label = "طباعة / حفظ PDF" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={buttonSecondaryClass}
    >
      {label}
    </button>
  );
}
