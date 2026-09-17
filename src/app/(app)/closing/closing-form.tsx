"use client";

import { useActionState, useState } from "react";

import { Alert, Field, buttonClass, inputClass } from "@/components/ui";
import { formatMoney } from "@/lib/format";
import type { ActionState } from "./actions";

export function ClosingForm({
  action,
  date,
  calculatedClosing,
  defaultActualCash,
  defaultNote,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  date: string;
  calculatedClosing: number;
  defaultActualCash: number | "";
  defaultNote: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [actual, setActual] = useState<string>(
    defaultActualCash === "" ? "" : String(defaultActualCash),
  );

  const actualNumber = actual === "" ? null : Number(actual);
  const difference =
    actualNumber === null || Number.isNaN(actualNumber)
      ? null
      : actualNumber - calculatedClosing;

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Alert>{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}

      <input type="hidden" name="date" value={date} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="الرصيد الفعلي في الخزنة"
          required
          hint="عُدّ الكاش الموجود فعلًا واكتبه"
        >
          <input
            name="actualCash"
            type="number"
            min={0}
            step={1}
            value={actual}
            onChange={(event) => setActual(event.target.value)}
            className={inputClass}
            required
          />
        </Field>

        <div>
          <span className="mb-1.5 block text-sm font-medium text-slate-700">
            الفرق
          </span>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
            {difference === null ? (
              <span className="text-slate-400">اكتب الرصيد الفعلي</span>
            ) : difference === 0 ? (
              <span className="font-medium text-emerald-600">مطابق تمامًا</span>
            ) : difference < 0 ? (
              <span className="num font-medium text-rose-600">
                عجز {formatMoney(Math.abs(difference))} ج.م
              </span>
            ) : (
              <span className="num font-medium text-amber-600">
                زيادة {formatMoney(difference)} ج.م
              </span>
            )}
          </div>
          <span className="mt-1 block text-xs text-slate-400">
            الفرق يُسجَّل منفصلًا ولا يُرحَّل لرصيد الغد
          </span>
        </div>
      </div>

      <Field label="سبب الفرق / ملاحظة">
        <input
          name="differenceNote"
          defaultValue={defaultNote}
          className={inputClass}
          placeholder="اختياري"
        />
      </Field>

      <button type="submit" className={buttonClass} disabled={pending}>
        {pending ? "جاري الإقفال..." : "إقفال اليوم"}
      </button>
    </form>
  );
}
