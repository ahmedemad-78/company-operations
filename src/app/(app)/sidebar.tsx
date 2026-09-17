"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { LayoutDashboard, Users, CalendarCheck, SlidersHorizontal, HandCoins, Banknote, Wallet, LockKeyhole, Package, FileText, ChartNoAxesCombined, History, Settings, Circle } from "lucide-react";

import { NAV_GROUPS } from "./nav";

const icons = { "/": LayoutDashboard, "/employees": Users, "/attendance": CalendarCheck, "/adjustments": SlidersHorizontal, "/advances": HandCoins, "/payroll": Banknote, "/cash": Wallet, "/closing": LockKeyhole, "/bearings": Package, "/quotations": FileText, "/reports": ChartNoAxesCombined, "/audit": History, "/settings": Settings };

export function Sidebar({ isSuperAdmin, onNavigate }: { isSuperAdmin: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="space-y-5" aria-label="أقسام النظام">
      {NAV_GROUPS.map((group) => {
        const items = group.items.filter(
          (item) => !item.superAdminOnly || isSuperAdmin,
        );
        if (items.length === 0) return null;

        return (
          <div key={group.title}>
            <p className="mb-2 px-3 text-xs font-semibold text-slate-300">
              {group.title}
            </p>
            <ul className="space-y-1">
              {items.map((item) => {
                const Icon = icons[item.href as keyof typeof icons] ?? Circle;
                const active =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={clsx(
                        "flex min-h-11 items-center gap-3 border-r-2 border-transparent rounded-sm px-3 py-2.5 text-sm transition",
                        active
                          ? "border-r-brand-500 bg-white/10 font-medium text-white"
                          : "text-slate-200 hover:bg-white/10 hover:text-white",
                      )}
                    >
                      <Icon size={18} className="shrink-0" aria-hidden="true" /><span>{item.label}</span>
                      {item.soon ? (
                        <span
                          className={clsx(
                            "mr-auto rounded px-1.5 py-0.5 text-[10px]",
                            active
                              ? "bg-white/20 text-white"
                              : "bg-white/10 text-slate-300",
                          )}
                        >
                          قريبًا
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
