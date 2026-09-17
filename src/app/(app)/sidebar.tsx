"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";

import { NAV_GROUPS } from "./nav";

export function Sidebar({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const pathname = usePathname();

  return (
    <nav className="space-y-6">
      {NAV_GROUPS.map((group) => {
        const items = group.items.filter(
          (item) => !item.superAdminOnly || isSuperAdmin,
        );
        if (items.length === 0) return null;

        return (
          <div key={group.title}>
            <p className="mb-2 px-3 text-xs font-semibold text-slate-400">
              {group.title}
            </p>
            <ul className="space-y-1">
              {items.map((item) => {
                const active =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={clsx(
                        "flex items-center justify-between rounded-lg px-3 py-2 text-sm transition",
                        active
                          ? "bg-blue-600 font-medium text-white"
                          : "text-slate-600 hover:bg-slate-100",
                      )}
                    >
                      <span>{item.label}</span>
                      {item.soon ? (
                        <span
                          className={clsx(
                            "rounded px-1.5 py-0.5 text-[10px]",
                            active
                              ? "bg-white/20 text-white"
                              : "bg-slate-100 text-slate-400",
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
