"use client";

import { useRef } from "react";
import { Menu } from "lucide-react";
import { Sidebar } from "./sidebar";

export function MobileNavigation({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const details = useRef<HTMLDetailsElement>(null);
  return (
    <details ref={details} className="no-print border-b border-slate-200 bg-white lg:hidden" onKeyDown={(event) => {
      if (event.key === "Escape" && details.current?.open) {
        details.current.open = false;
        details.current.querySelector("summary")?.focus();
      }
    }}>
      <summary className="flex min-h-12 list-none items-center gap-2 px-4 py-3 text-sm font-semibold text-navy-900 [&::-webkit-details-marker]:hidden"><Menu size={19} aria-hidden="true" />أقسام النظام</summary>
      <div className="bg-navy-900 p-4"><Sidebar isSuperAdmin={isSuperAdmin} onNavigate={() => { if (details.current) details.current.open = false; }} /></div>
    </details>
  );
}
