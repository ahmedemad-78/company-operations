"use client";

import { useActionState, useState } from "react";

import { Alert, Field, buttonClass, inputClass } from "@/components/ui";
import { FUNDING_SOURCE, FUNDING_SOURCE_LABEL } from "@/lib/constants";
import type { ActionState } from "./actions";

export function AdvanceForm({
  action,
  employees,
  defaultDate,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  employees: Array<{ id: string; name: string }>;
  defaultDate: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [isOpeningBalance, setIsOpeningBalance] = useState(false);

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Alert>{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Field label="الموظف" required>
          <select name="employeeId" className={inputClass} required>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name}
              </option>
            ))}
          </select>
        </Field>

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

        <Field label="التاريخ" required>
          <input
            name="date"
            type="date"
            defaultValue={defaultDate}
            className={inputClass}
            required
          />
        </Field>

        <Field
          label="مصدر الصرف"
          required
          hint="المدير شخصيًا = لا يؤثر على الخزنة"
        >
          <select
            name="fundingSource"
            defaultValue={FUNDING_SOURCE.COMPANY_CASH}
            className={inputClass}
            disabled={isOpeningBalance}
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

        <Field label="السبب / ملاحظة">
          <input name="note" className={inputClass} placeholder="اختياري" />
        </Field>
      </div>

      <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <input
          type="checkbox"
          name="isOpeningBalance"
          checked={isOpeningBalance}
          onChange={(event) => setIsOpeningBalance(event.target.checked)}
          className="mt-0.5 size-4"
        />
        <span className="text-sm text-slate-700">
          سلفة قائمة قديمة (رصيد افتتاحي)
          <span className="mt-0.5 block text-xs text-slate-400">
            تُسجَّل كرصيد على الموظف فقط بدون حركة خزنة — للسلف اللي اتصرفت قبل تشغيل
            النظام
          </span>
        </span>
      </label>

      <button type="submit" className={buttonClass} disabled={pending}>
        {pending ? "جاري الحفظ..." : "تسجيل السلفة"}
      </button>
    </form>
  );
}
