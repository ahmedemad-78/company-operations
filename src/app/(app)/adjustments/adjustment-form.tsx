"use client";

import { useActionState, useState } from "react";

import { Alert, Field, buttonClass, inputClass } from "@/components/ui";
import { INCENTIVE_KIND, VALUE_TYPE, VALUE_TYPE_LABEL } from "@/lib/constants";
import type { ActionState } from "./actions";

/**
 * نموذج واحد للحوافز والخصومات وبدل الإجازة غير المستخدمة:
 * المستخدم يختار النوع (مبلغ / أيام / ساعات) والنظام يحوّله لمبلغ على السيرفر.
 */
export function AdjustmentForm({
  action,
  employees,
  year,
  month,
  submitLabel,
  kind,
  allowDays = true,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  employees: Array<{ id: string; name: string }>;
  year: number;
  month: number;
  submitLabel: string;
  kind?: string;
  allowDays?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [valueType, setValueType] = useState<string>(VALUE_TYPE.AMOUNT);

  const isAmount = valueType === VALUE_TYPE.AMOUNT;
  const options = allowDays
    ? [VALUE_TYPE.AMOUNT, VALUE_TYPE.DAYS, VALUE_TYPE.HOURS]
    : [VALUE_TYPE.AMOUNT];

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Alert>{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}

      <input type="hidden" name="year" value={year} />
      <input type="hidden" name="month" value={month} />
      {kind ? <input type="hidden" name="kind" value={kind} /> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="الموظف" required>
          <select name="employeeId" className={inputClass} required>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="النوع" required>
          <select
            name="valueType"
            value={valueType}
            onChange={(event) => setValueType(event.target.value)}
            className={inputClass}
            required
          >
            {options.map((option) => (
              <option key={option} value={option}>
                {VALUE_TYPE_LABEL[option]}
              </option>
            ))}
          </select>
        </Field>

        {isAmount ? (
          <Field label="المبلغ" required hint="بالجنيه">
            <input
              name="amount"
              type="number"
              min={1}
              step={1}
              className={inputClass}
              required
            />
          </Field>
        ) : (
          <Field
            label={valueType === VALUE_TYPE.DAYS ? "عدد الأيام" : "عدد الساعات"}
            required
            hint="النظام يحوّلها لمبلغ حسب مرتب الموظف"
          >
            <input
              name="quantity"
              type="number"
              min={0.5}
              step={0.5}
              className={inputClass}
              required
            />
          </Field>
        )}

        <Field label="ملاحظة / السبب">
          <input name="note" className={inputClass} placeholder="اختياري" />
        </Field>
      </div>

      <button type="submit" className={buttonClass} disabled={pending}>
        {pending ? "جاري الحفظ..." : submitLabel}
      </button>

      {kind === INCENTIVE_KIND.UNUSED_LEAVE ? (
        <p className="text-xs text-slate-400">
          بدل يوم الإجازة الشهري غير المستخدم يُدخَل يدويًا بالكامل (قرار BRD رقم 4).
        </p>
      ) : null}
    </form>
  );
}
