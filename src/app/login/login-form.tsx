"use client";

import { useActionState, useState } from "react";
import { ArrowLeft, Eye, EyeOff, LoaderCircle } from "lucide-react";

import { login, type LoginState } from "./actions";
import { Alert, Field, buttonClass, inputClass } from "@/components/ui";

const initialState: LoginState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initialState);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={formAction} className="space-y-5" aria-busy={pending}>
      {state.error ? <Alert>{state.error}</Alert> : null}

      <Field label="البريد الإلكتروني" required>
        <input
          type="email"
          name="email"
          dir="ltr"
          autoComplete="username"
          placeholder="name@company.com"
          className={inputClass}
          required
        />
      </Field>

      <div>
        <label htmlFor="login-password" className="mb-1.5 block text-sm font-medium text-slate-700">كلمة المرور <span className="text-rose-500">*</span></label>
        <div className="relative">
        <input
          id="login-password"
          type={showPassword ? "text" : "password"}
          name="password"
          dir="ltr"
          autoComplete="current-password"
          className={`${inputClass} pl-12`}
          required
        />
        <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"} aria-pressed={showPassword} aria-controls="login-password" className="absolute inset-y-0 left-0 flex w-11 items-center justify-center rounded-l-xl text-slate-500 hover:text-brand-700">
          {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
        </button>
        </div>
      </div>

      <button type="submit" className={`${buttonClass} w-full`} disabled={pending}>
        {pending ? "جاري الدخول..." : "تسجيل الدخول"}
        {pending ? <LoaderCircle size={18} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <ArrowLeft size={18} aria-hidden="true" />}
      </button>
    </form>
  );
}
