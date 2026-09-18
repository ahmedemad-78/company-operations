"use client";

import { useActionState } from "react";

import {
  Alert,
  buttonClass,
  buttonSecondaryClass,
  inputClass,
} from "@/components/ui";
import { FUNDING_SOURCE, FUNDING_SOURCE_LABEL } from "@/lib/constants";
import type { ActionState } from "./actions";

export function RecalculateForm({
  action,
  year,
  month,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  year: number;
  month: number;
}) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <div className="space-y-3">
      {state.error ? <Alert>{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}
      <form action={formAction}>
        <input type="hidden" name="year" value={year} />
        <input type="hidden" name="month" value={month} />
        <button type="submit" className={buttonClass} disabled={pending}>
          {pending ? "جاري الحساب..." : "حساب / تحديث مرتبات الشهر"}
        </button>
      </form>
    </div>
  );
}

export function LockForm({
  action,
  year,
  month,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  year: number;
  month: number;
}) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <div className="space-y-3">
      {state.error ? <Alert>{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}
      <form action={formAction}>
        <input type="hidden" name="year" value={year} />
        <input type="hidden" name="month" value={month} />
        <button type="submit" className={buttonSecondaryClass} disabled={pending}>
          {pending ? "جاري الإقفال..." : "إقفال مرتبات الشهر"}
        </button>
      </form>
    </div>
  );
}

export function AdvanceDeductionForm({
  action,
  lineId,
  current,
  remaining,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  lineId: string;
  current: number;
  remaining: number;
}) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="space-y-2">
      {state.error ? <Alert>{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}

      <input type="hidden" name="lineId" value={lineId} />
      <div className="flex items-center gap-2">
        <input
          name="advanceDeduction"
          type="number"
          min={0}
          step={1}
          max={remaining + current}
          defaultValue={current}
          className={`${inputClass} w-28`}
        />
        <button type="submit" className={buttonSecondaryClass} disabled={pending}>
          {pending ? "جاري الحفظ..." : "حفظ"}
        </button>
      </div>
    </form>
  );
}

export function PayForm({
  action,
  lineId,
  defaultDate,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  lineId: string;
  defaultDate: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="space-y-2">
      {state.error ? <Alert>{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}

      <input type="hidden" name="lineId" value={lineId} />
      <div className="flex flex-wrap items-center gap-2">
        <input
          name="paidAt"
          type="date"
          defaultValue={defaultDate}
          className={`${inputClass} w-36`}
          required
        />
        <select
          name="fundingSource"
          defaultValue={FUNDING_SOURCE.COMPANY_CASH}
          className={`${inputClass} w-36`}
        >
          <option value={FUNDING_SOURCE.COMPANY_CASH}>
            {FUNDING_SOURCE_LABEL.COMPANY_CASH}
          </option>
          <option value={FUNDING_SOURCE.MANAGER_PERSONAL}>
            {FUNDING_SOURCE_LABEL.MANAGER_PERSONAL}
          </option>
        </select>
        <button type="submit" className={buttonClass} disabled={pending}>
          {pending ? "جاري الصرف..." : "صرف"}
        </button>
      </div>
    </form>
  );
}
