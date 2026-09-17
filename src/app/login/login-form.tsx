"use client";

import { useActionState } from "react";

import { login, type LoginState } from "./actions";
import { Alert, Field, buttonClass, inputClass } from "@/components/ui";

const initialState: LoginState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Alert>{state.error}</Alert> : null}

      <Field label="البريد الإلكتروني" required>
        <input
          type="email"
          name="email"
          dir="ltr"
          autoComplete="username"
          className={inputClass}
          required
        />
      </Field>

      <Field label="كلمة المرور" required>
        <input
          type="password"
          name="password"
          dir="ltr"
          autoComplete="current-password"
          className={inputClass}
          required
        />
      </Field>

      <button type="submit" className={`${buttonClass} w-full`} disabled={pending}>
        {pending ? "جاري الدخول..." : "تسجيل الدخول"}
      </button>
    </form>
  );
}
