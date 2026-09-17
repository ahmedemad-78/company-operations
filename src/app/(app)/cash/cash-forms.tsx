"use client";

import { useActionState } from "react";

import {
  Alert,
  Field,
  buttonClass,
  buttonSecondaryClass,
  inputClass,
} from "@/components/ui";
import { CASH_TYPE, FUNDING_SOURCE, FUNDING_SOURCE_LABEL } from "@/lib/constants";
import type { ActionState } from "./actions";

export type TransactionValues = {
  id?: string;
  date: string;
  amount: number | "";
  counterparty: string;
  fundingSource: string;
  note: string;
};

export function TransactionForm({
  action,
  type,
  values,
  submitLabel,
  layout = "stacked",
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  type: string;
  values: TransactionValues;
  submitLabel: string;
  layout?: "stacked" | "inline";
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const isExpense = type === CASH_TYPE.EXPENSE;

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Alert>{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}

      <input type="hidden" name="type" value={type} />
      {values.id ? <input type="hidden" name="id" value={values.id} /> : null}

      <div
        className={
          layout === "inline"
            ? "grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
            : "grid gap-4 sm:grid-cols-2"
        }
      >
        <Field label="المبلغ" required hint="بالجنيه، بدون كسور">
          <input
            name="amount"
            type="number"
            min={1}
            step={1}
            defaultValue={values.amount}
            className={inputClass}
            required
          />
        </Field>

        <Field label={isExpense ? "الوصف / الجهة" : "الجهة / اسم الدافع"} required>
          <input
            name="counterparty"
            defaultValue={values.counterparty}
            placeholder={isExpense ? "مثال: بنزين السيارة" : "مثال: شركة النور"}
            className={inputClass}
            required
          />
        </Field>

        <Field label="التاريخ" required>
          <input
            name="date"
            type="date"
            defaultValue={values.date}
            className={inputClass}
            required
          />
        </Field>

        {isExpense ? (
          <Field
            label="مصدر الصرف"
            required
            hint="المدير شخصيًا = لا يؤثر على رصيد الخزنة"
          >
            <select
              name="fundingSource"
              defaultValue={values.fundingSource}
              className={inputClass}
              required
            >
              <option value={FUNDING_SOURCE.COMPANY_CASH}>
                {FUNDING_SOURCE_LABEL.COMPANY_CASH}
              </option>
              <option value={FUNDING_SOURCE.MANAGER_PERSONAL}>
                {FUNDING_SOURCE_LABEL.MANAGER_PERSONAL}
              </option>
            </select>
          </Field>
        ) : null}

        <Field label="ملاحظة">
          <input name="note" defaultValue={values.note} className={inputClass} />
        </Field>
      </div>

      <button
        type="submit"
        className={values.id ? buttonSecondaryClass : buttonClass}
        disabled={pending}
      >
        {pending ? "جاري الحفظ..." : submitLabel}
      </button>
    </form>
  );
}
