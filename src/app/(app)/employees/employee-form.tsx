"use client";

import { useActionState } from "react";
import Link from "next/link";

import {
  Alert,
  Field,
  buttonClass,
  buttonSecondaryClass,
  inputClass,
} from "@/components/ui";
import type { ActionState } from "./actions";

type EmployeeFormValues = {
  id?: string;
  name: string;
  jobTitle: string;
  basicSalary: number;
  weeklyTransportAllowance: number;
  startDate: string;
  endDate: string;
  hasFixedSchedule: boolean;
  monthlyPaidLeaveDays: number;
  note: string | null;
};

export function EmployeeForm({
  action,
  values,
  mode,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  values: EmployeeFormValues;
  mode: "create" | "edit";
}) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="space-y-5">
      {state.error ? <Alert>{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}

      {values.id ? <input type="hidden" name="id" value={values.id} /> : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="اسم الموظف" required>
          <input
            name="name"
            defaultValue={values.name}
            className={inputClass}
            required
          />
        </Field>

        <Field label="الوظيفة" required>
          <input
            name="jobTitle"
            defaultValue={values.jobTitle}
            className={inputClass}
            required
          />
        </Field>

        {mode === "create" ? (
          <Field label="المرتب الأساسي (شهري)" required hint="بالجنيه، بدون كسور">
            <input
              name="basicSalary"
              type="number"
              min={0}
              step={1}
              defaultValue={values.basicSalary || ""}
              className={inputClass}
              required
            />
          </Field>
        ) : (
          <Field
            label="المرتب الأساسي (شهري)"
            hint="التعديل يتم من خلال «تغيير المرتب» حتى يُسجَّل في سجل المرتبات"
          >
            <input
              value={values.basicSalary}
              className={inputClass}
              disabled
              readOnly
            />
          </Field>
        )}

        <Field
          label="بدل المواصلات الأسبوعي"
          hint="مصروف شركة — خارج حساب المرتب"
        >
          <input
            name="weeklyTransportAllowance"
            type="number"
            min={0}
            step={1}
            defaultValue={values.weeklyTransportAllowance}
            className={inputClass}
          />
        </Field>

        <Field label="تاريخ بداية العمل" required>
          <input
            name="startDate"
            type="date"
            defaultValue={values.startDate}
            className={inputClass}
            required
          />
        </Field>

        <Field
          label="آخر يوم عمل"
          hint="يُملأ عند ترك الموظف العمل فقط — المرتب يُحسب بالتناسب حتى هذا اليوم"
        >
          <input
            name="endDate"
            type="date"
            defaultValue={values.endDate}
            className={inputClass}
          />
        </Field>

        <Field
          label="أيام الإجازة المدفوعة شهريًا"
          required
          hint="الموظف العادي يوم، والمدير الإداري يومان"
        >
          <input
            name="monthlyPaidLeaveDays"
            type="number"
            min={0}
            max={31}
            step={1}
            defaultValue={values.monthlyPaidLeaveDays}
            className={inputClass}
            required
          />
        </Field>
      </div>

      <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <input
          type="checkbox"
          name="hasFixedSchedule"
          defaultChecked={values.hasFixedSchedule}
          className="mt-0.5 size-4"
        />
        <span className="text-sm text-slate-700">
          مواعيد عمل ثابتة (9:00 ص → 7:00 م)
          <span className="mt-0.5 block text-xs text-slate-400">
            اتركها بدون تحديد للمدير الإداري لأن مواعيده غير ثابتة
          </span>
        </span>
      </label>

      <Field label="ملاحظات">
        <textarea
          name="note"
          rows={3}
          defaultValue={values.note ?? ""}
          className={inputClass}
        />
      </Field>

      <div className="flex items-center gap-3">
        <button type="submit" className={buttonClass} disabled={pending}>
          {pending
            ? "جاري الحفظ..."
            : mode === "create"
              ? "إضافة الموظف"
              : "حفظ التعديلات"}
        </button>
        <Link
          href={values.id ? `/employees/${values.id}` : "/employees"}
          className={buttonSecondaryClass}
        >
          إلغاء
        </Link>
      </div>
    </form>
  );
}
