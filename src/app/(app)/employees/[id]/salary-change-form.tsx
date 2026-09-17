"use client";

import { useActionState } from "react";

import { Alert, Field, buttonClass, inputClass } from "@/components/ui";
import { changeSalary } from "../actions";

export function SalaryChangeForm({
  employeeId,
  currentSalary,
  today,
}: {
  employeeId: string;
  currentSalary: number;
  today: string;
}) {
  const [state, formAction, pending] = useActionState(changeSalary, {});

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Alert>{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}

      <input type="hidden" name="id" value={employeeId} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="المرتب الجديد" required hint={`المرتب الحالي: ${currentSalary}`}>
          <input
            name="newSalary"
            type="number"
            min={0}
            step={1}
            className={inputClass}
            required
          />
        </Field>

        <Field label="تاريخ تطبيق المرتب الجديد" required>
          <input
            name="effectiveDate"
            type="date"
            defaultValue={today}
            className={inputClass}
            required
          />
        </Field>
      </div>

      <button type="submit" className={buttonClass} disabled={pending}>
        {pending ? "جاري الحفظ..." : "تسجيل المرتب الجديد"}
      </button>
    </form>
  );
}
