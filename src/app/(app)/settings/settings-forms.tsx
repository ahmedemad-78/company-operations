"use client";

import { useActionState } from "react";

import { Alert, Field, buttonClass, inputClass } from "@/components/ui";
import type { ActionState } from "./actions";

export function SettingsForm({
  action,
  values,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  values: Record<string, string>;
}) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="space-y-5">
      {state.error ? <Alert>{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="اسم الشركة" required hint="يظهر في رأس التقارير وعروض الأسعار">
          <input
            name="COMPANY_NAME"
            defaultValue={values.COMPANY_NAME}
            className={inputClass}
            required
          />
        </Field>

        <Field label="تليفونات الشركة">
          <input
            name="COMPANY_PHONE"
            defaultValue={values.COMPANY_PHONE}
            className={inputClass}
          />
        </Field>

        <Field label="عنوان الشركة">
          <input
            name="COMPANY_ADDRESS"
            defaultValue={values.COMPANY_ADDRESS}
            className={inputClass}
          />
        </Field>

        <Field
          label="تاريخ بداية بيانات النظام"
          required
          hint="لا يمكن تسجيل أي حركة خزنة قبل هذا التاريخ"
        >
          <input
            name="SYSTEM_START_DATE"
            type="date"
            defaultValue={values.SYSTEM_START_DATE}
            className={inputClass}
            required
          />
        </Field>

        <Field
          label="رصيد الخزنة الافتتاحي"
          required
          hint="الكاش الموجود في الخزنة في تاريخ بداية النظام — أساس كل الأرصدة بعد كده"
        >
          <input
            name="OPENING_CASH_BALANCE"
            type="number"
            min={0}
            step={1}
            defaultValue={values.OPENING_CASH_BALANCE}
            className={inputClass}
            required
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="بداية يوم العمل" required>
            <input
              name="WORK_START"
              type="time"
              defaultValue={values.WORK_START}
              className={inputClass}
              required
            />
          </Field>
          <Field label="نهاية يوم العمل" required>
            <input
              name="WORK_END"
              type="time"
              defaultValue={values.WORK_END}
              className={inputClass}
              required
            />
          </Field>
        </div>
      </div>

      <button type="submit" className={buttonClass} disabled={pending}>
        {pending ? "جاري الحفظ..." : "حفظ الإعدادات"}
      </button>
    </form>
  );
}

export function HolidayForm({
  action,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
}) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Alert>{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-44">
          <Field label="التاريخ" required>
            <input name="date" type="date" className={inputClass} required />
          </Field>
        </div>
        <div className="min-w-56 flex-1">
          <Field label="اسم العطلة" required>
            <input
              name="name"
              placeholder="مثال: عيد الفطر"
              className={inputClass}
              required
            />
          </Field>
        </div>
        <button type="submit" className={buttonClass} disabled={pending}>
          {pending ? "جاري الإضافة..." : "إضافة عطلة"}
        </button>
      </div>
    </form>
  );
}
