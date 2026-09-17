"use client";

import { buttonDangerClass } from "@/components/ui";
import { deleteQuotation } from "../actions";

export function QuotationDangerActions({
  quotationId,
}: {
  quotationId: string;
}) {
  return (
    <form
      action={deleteQuotation}
      onSubmit={(event) => {
        if (
          !window.confirm(
            "سيتم إلغاء عرض السعر وإخفاؤه من الشاشات مع الاحتفاظ به في قاعدة البيانات وسجل التغييرات. هل تريد المتابعة؟",
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={quotationId} />
      <button type="submit" className={buttonDangerClass}>
        إلغاء عرض السعر
      </button>
    </form>
  );
}
