"use client";

import { useActionState } from "react";

import {
  Alert,
  Field,
  buttonClass,
  buttonSecondaryClass,
  inputClass,
} from "@/components/ui";
import type { ActionState } from "./user-actions";

export function CreateManagerForm({
  action,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
}) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Alert>{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="اسم المدير" required>
          <input name="name" className={inputClass} required />
        </Field>
        <Field label="البريد الإلكتروني" required>
          <input name="email" type="email" dir="ltr" className={inputClass} required />
        </Field>
        <Field label="كلمة المرور" required hint="8 حروف على الأقل">
          <input
            name="password"
            type="text"
            dir="ltr"
            minLength={8}
            className={inputClass}
            required
          />
        </Field>
      </div>

      <button type="submit" className={buttonClass} disabled={pending}>
        {pending ? "جاري الإنشاء..." : "إنشاء حساب مدير"}
      </button>
      <p className="text-xs text-slate-400">
        حساب المدير مشاهدة وتصدير فقط، ما عدا حركات الرومان بلي.
      </p>
    </form>
  );
}

export function ResetPasswordForm({
  action,
  userId,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  userId: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="space-y-2">
      {state.error ? <Alert>{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}

      <input type="hidden" name="id" value={userId} />
      <div className="flex items-center gap-2">
        <input
          name="password"
          type="text"
          dir="ltr"
          minLength={8}
          placeholder="كلمة مرور جديدة"
          className={`${inputClass} w-48`}
          required
        />
        <button type="submit" className={buttonSecondaryClass} disabled={pending}>
          {pending ? "..." : "تغيير"}
        </button>
      </div>
    </form>
  );
}
