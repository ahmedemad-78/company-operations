import Link from "next/link";

import { buttonClass } from "@/components/ui";

export default function NoAccessPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-bold text-slate-900">غير مسموح بالوصول</h1>
        <p className="mt-2 text-sm text-slate-500">
          هذا القسم متاح للمدير الإداري فقط. صلاحيتك تسمح بالمشاهدة وتصدير
          التقارير.
        </p>
        <div className="mt-6">
          <Link href="/" className={buttonClass}>
            رجوع للوحة التحكم
          </Link>
        </div>
      </div>
    </main>
  );
}
