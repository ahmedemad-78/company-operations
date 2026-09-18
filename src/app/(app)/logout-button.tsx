"use client";

import { useTransition } from "react";

import { logout } from "./logout-action";

export function LogoutButton() {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      onClick={() => startTransition(() => logout())}
      disabled={pending}
      data-loading={pending || undefined}
      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
    >
      {pending ? "جاري الخروج..." : "خروج"}
    </button>
  );
}
