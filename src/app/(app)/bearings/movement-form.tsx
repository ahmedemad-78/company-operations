"use client";

import { useActionState, useEffect, useRef } from "react";
import Link from "next/link";

import {
  Alert,
  Field,
  buttonClass,
  buttonSecondaryClass,
  inputClass,
} from "@/components/ui";
import { BEARING_MOVEMENT_TYPE, BEARING_MOVEMENT_TYPE_LABEL } from "@/lib/constants";
import type { ActionState } from "./actions";

export type MovementFormValues = {
  id?: string;
  type: string;
  date: string;
  quantity: number | "";
  note: string | null;
};

export function MovementForm({
  action,
  values,
  mode,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  values: MovementFormValues;
  mode: "create" | "edit";
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const formRef = useRef<HTMLFormElement>(null);

  // بعد تسجيل حركة جديدة نفضي الحقول عشان الإدخال التالي
  useEffect(() => {
    if (mode === "create" && state.success) formRef.current?.reset();
  }, [mode, state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-5">
      {state.error ? <Alert>{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}

      {values.id ? <input type="hidden" name="id" value={values.id} /> : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="نوع الحركة" required>
          <select name="type" defaultValue={values.type} className={inputClass} required>
            <option value={BEARING_MOVEMENT_TYPE.IN}>
              {BEARING_MOVEMENT_TYPE_LABEL.IN} (شراء / إضافة)
            </option>
            <option value={BEARING_MOVEMENT_TYPE.OUT}>
              {BEARING_MOVEMENT_TYPE_LABEL.OUT} (صرف للشغل)
            </option>
            <option value={BEARING_MOVEMENT_TYPE.OPENING}>
              {BEARING_MOVEMENT_TYPE_LABEL.OPENING} (كمية بداية التشغيل)
            </option>
          </select>
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

        <Field label="الكمية" required hint="بالقطعة، أرقام صحيحة بدون كسور">
          <input
            name="quantity"
            type="number"
            min={1}
            step={1}
            defaultValue={values.quantity}
            className={inputClass}
            required
          />
        </Field>

        <Field label="ملاحظات" hint="اختياري — مثلًا اسم المورد أو العربية اللي اتصرفت عليها">
          <input name="note" defaultValue={values.note ?? ""} className={inputClass} />
        </Field>
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" className={buttonClass} disabled={pending}>
          {pending
            ? "جاري الحفظ..."
            : mode === "create"
              ? "تسجيل الحركة"
              : "حفظ التعديلات"}
        </button>
        {mode === "edit" ? (
          <Link href="/bearings" className={buttonSecondaryClass}>
            رجوع
          </Link>
        ) : null}
      </div>
    </form>
  );
}
