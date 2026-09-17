import { redirect } from "next/navigation";
import { Layers3, ArrowUpLeft, Users, Wallet, ChartNoAxesCombined } from "lucide-react";

import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "./login-form";

const features = [
  { icon: Users, label: "إدارة الموظفين" },
  { icon: Wallet, label: "متابعة العمليات المالية" },
  { icon: ChartNoAxesCombined, label: "تقارير تدعم قراراتك" },
];

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/");

  return (
    <main className="flex min-h-dvh items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-900/5">
        <header className="flex items-center gap-3 border-b border-slate-100 px-6 py-5 sm:px-10">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white"><Layers3 size={23} aria-hidden="true" /></span>
          <span className="text-sm font-bold text-navy-900 sm:text-base">نظام إدارة وتشغيل الشركة</span>
        </header>
        <div className="grid md:grid-cols-[1.1fr_1fr]">
          <section className="px-6 py-10 sm:px-12 sm:py-14">
            <p className="mb-3 text-xs font-bold text-brand-700">مساحة عملك</p>
            <h1 className="text-3xl font-bold leading-relaxed text-navy-900">مرحباً بعودتك</h1>
            <p className="mb-8 mt-2 text-sm leading-7 text-slate-500">سجّل الدخول للمتابعة إلى حسابك.</p>
            <LoginForm />
            <p className="mt-7 text-center text-xs leading-6 text-slate-500">نظام داخلي لإدارة أعمال الشركة</p>
          </section>
          <aside className="hidden flex-col justify-between bg-navy-900 p-10 text-white md:flex">
            <div>
              <p className="text-xs tracking-[0.2em] text-teal-200" dir="ltr">COMPANY OPERATIONS</p>
              <h2 className="mt-10 text-4xl font-bold leading-[1.7]">وضوح أكثر.<br />عمل أكثر تنظيماً.</h2>
              <p className="mt-4 max-w-xs text-sm leading-8 text-slate-300">الموظفون، والحسابات، والتقارير.<br />كل ما تحتاجه لإدارة يومك في مساحة واحدة.</p>
            </div>
            <div className="mt-10 space-y-3 border-t border-white/15 pt-6">
              {features.map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-3 text-sm text-slate-200">
                  <Icon size={18} className="text-teal-300" aria-hidden="true" />
                  <span>{label}</span>
                  <ArrowUpLeft size={16} className="mr-auto text-slate-400" aria-hidden="true" />
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
