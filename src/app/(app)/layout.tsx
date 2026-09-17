import { requireUser } from "@/lib/auth";
import { ROLE, ROLE_LABEL } from "@/lib/constants";
import { Sidebar } from "./sidebar";
import { LogoutButton } from "./logout-button";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const isSuperAdmin = user.role === ROLE.SUPER_ADMIN;

  return (
    <div className="flex min-h-screen">
      <aside className="no-print hidden w-64 shrink-0 border-l border-slate-200 bg-white p-4 lg:block">
        <div className="mb-6 px-3">
          <p className="text-sm font-bold text-slate-900">إدارة وتشغيل الشركة</p>
          <p className="mt-0.5 text-xs text-slate-400">نظام داخلي</p>
        </div>
        <Sidebar isSuperAdmin={isSuperAdmin} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-3">
          <div className="lg:hidden">
            <p className="text-sm font-bold text-slate-900">إدارة وتشغيل الشركة</p>
          </div>
          <div className="flex flex-1 items-center justify-end gap-3">
            <div className="text-right">
              <p className="text-sm font-medium text-slate-800">{user.name}</p>
              <p className="text-xs text-slate-400">{ROLE_LABEL[user.role]}</p>
            </div>
            <LogoutButton />
          </div>
        </header>

        <main className="flex-1 px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
