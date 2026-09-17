import { requireUser } from "@/lib/auth";
import { ROLE, ROLE_LABEL } from "@/lib/constants";
import { Sidebar } from "./sidebar";
import { LogoutButton } from "./logout-button";
import { MobileNavigation } from "./mobile-navigation";
import { Brand } from "@/components/brand";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const isSuperAdmin = user.role === ROLE.SUPER_ADMIN;

  return (
    <div className="flex min-h-screen">
      <aside className="no-print hidden w-64 shrink-0 bg-ink-900 p-4 lg:block">
        <div className="mb-6 border-b border-white/15 px-2 pb-7 pt-3 text-center text-white">
          <Brand />
        </div>
        <Sidebar isSuperAdmin={isSuperAdmin} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 py-4 sm:px-8">
          <div className="lg:hidden">
            <Brand size="compact" />
          </div>
          <p className="hidden text-sm font-medium text-slate-500 lg:block">إدارة الشركة</p>
          <div className="flex flex-1 items-center justify-end gap-3">
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
