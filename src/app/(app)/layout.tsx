import { requireUser } from "@/lib/auth";
import { ROLE, ROLE_LABEL } from "@/lib/constants";
import { Sidebar } from "./sidebar";
import { LogoutButton } from "./logout-button";
import { MobileNavigation } from "./mobile-navigation";
import { Layers3 } from "lucide-react";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const isSuperAdmin = user.role === ROLE.SUPER_ADMIN;

  return (
    <div className="flex min-h-screen">
      <aside className="no-print hidden w-64 shrink-0 bg-navy-900 p-4 lg:block">
        <div className="mb-6 flex items-center gap-3 border-b border-white/10 px-2 pb-6 pt-2">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white"><Layers3 size={22} aria-hidden="true" /></span>
          <div><p className="text-sm font-bold text-white">إدارة وتشغيل الشركة</p>
          <p className="mt-1 text-xs text-slate-300">مساحة العمل الداخلية</p></div>
        </div>
        <Sidebar isSuperAdmin={isSuperAdmin} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 py-4 sm:px-8">
          <div className="lg:hidden">
            <p className="text-sm font-bold text-slate-900">إدارة وتشغيل الشركة</p>
          </div>
          <p className="hidden text-sm font-medium text-slate-500 lg:block">نظام إدارة وتشغيل الشركة</p>
          <div className="flex flex-1 items-center justify-end gap-3">
            <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-50 font-bold text-brand-700">{user.name.trim().charAt(0)}</span>
            <div className="text-right">
              <p className="text-sm font-medium text-slate-800">{user.name}</p>
              <p className="mt-1 text-xs text-slate-500">{ROLE_LABEL[user.role]}</p>
            </div>
            <LogoutButton />
          </div>
        </header>
        <MobileNavigation isSuperAdmin={isSuperAdmin} />
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
