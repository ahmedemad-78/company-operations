import { redirect } from "next/navigation";

import { Brand } from "@/components/brand";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/");

  return (
    <main className="flex min-h-dvh flex-col border-t-4 border-brand-600 bg-[#faf9f6] px-6">
      <div className="mx-auto flex w-full max-w-[360px] flex-1 flex-col justify-center py-12 sm:py-16">
        <header className="mb-12 text-center text-ink-900">
          <Brand size="login" />
        </header>
        <section aria-labelledby="login-heading">
          <div className="mb-7 border-t border-slate-300 pt-6">
            <h1 id="login-heading" className="text-lg font-bold text-ink-900">تسجيل الدخول</h1>
            <p className="mt-2 text-sm text-slate-500">أدخل بيانات حسابك للدخول إلى نظام الشركة.</p>
          </div>
          <LoginForm />
        </section>
      </div>
      <footer className="border-t border-slate-200 py-5 text-center text-xs text-slate-500">
        الأمير موتورز <span className="mx-2" aria-hidden="true">/</span> نظام إدارة الشركة
      </footer>
    </main>
  );
}
