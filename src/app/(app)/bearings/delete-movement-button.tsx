"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { buttonDangerClass } from "@/components/ui";
import { deleteBearingMovement } from "./actions";

export function DeleteMovementButton({
  id,
  label = "إلغاء",
  redirectTo,
}: {
  id: string;
  label?: string;
  redirectTo?: string;
}) {
  const [state, formAction, pending] = useActionState(deleteBearingMovement, {});
  const router = useRouter();

  useEffect(() => {
    if (state.success && redirectTo) router.push(redirectTo);
  }, [state, redirectTo, router]);

  return (
    <div className="flex flex-col items-start gap-1">
      <form
        action={formAction}
        onSubmit={(event) => {
          if (
            !window.confirm(
              "سيتم إلغاء الحركة وتعديل الكمية الحالية، مع الاحتفاظ بها في السجل والـAudit Log. هل تريد المتابعة؟",
            )
          ) {
            event.preventDefault();
          }
        }}
      >
        <input type="hidden" name="id" value={id} />
        <button type="submit" className={buttonDangerClass} disabled={pending}>
          {pending ? "جاري الإلغاء..." : label}
        </button>
      </form>
      {state.error ? (
        <span className="max-w-64 text-xs text-rose-600">{state.error}</span>
      ) : null}
    </div>
  );
}
