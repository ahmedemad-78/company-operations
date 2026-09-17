"use client";

import { useActionState, useState } from "react";

import {
  Alert,
  Table,
  Td,
  Th,
  buttonClass,
  buttonSecondaryClass,
  inputClass,
} from "@/components/ui";
import { ATTENDANCE_STATUS, ATTENDANCE_STATUS_LABEL } from "@/lib/constants";
import type { ActionState } from "./actions";

export type AttendanceRow = {
  employeeId: string;
  name: string;
  jobTitle: string;
  status: string;
  note: string;
  workedFriday: boolean;
  scheduleLabel: string;
};

const STATUS_OPTIONS = [
  ATTENDANCE_STATUS.PRESENT,
  ATTENDANCE_STATUS.ABSENT,
  ATTENDANCE_STATUS.LEAVE,
  ATTENDANCE_STATUS.SICK,
];

export function AttendanceForm({
  action,
  date,
  rows,
  isFriday,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  date: string;
  rows: AttendanceRow[];
  isFriday: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [statuses, setStatuses] = useState<Record<string, string>>(() =>
    Object.fromEntries(rows.map((row) => [row.employeeId, row.status])),
  );

  function markAllPresent() {
    setStatuses(
      Object.fromEntries(
        rows.map((row) => [row.employeeId, ATTENDANCE_STATUS.PRESENT]),
      ),
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Alert>{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}

      <input type="hidden" name="date" value={date} />

      {!isFriday ? (
        <button type="button" onClick={markAllPresent} className={buttonSecondaryClass}>
          تحديد الكل حاضر
        </button>
      ) : null}

      <Table>
        <thead>
          <tr>
            <Th>الموظف</Th>
            <Th className="w-40">{isFriday ? "عمل يوم الجمعة؟" : "الحالة"}</Th>
            <Th>ملاحظة</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.employeeId}>
              <Td>
                <span className="font-medium text-slate-800">{row.name}</span>
                <span className="mt-0.5 block text-xs text-slate-400">
                  {row.jobTitle} — {row.scheduleLabel}
                </span>
              </Td>
              <Td>
                {isFriday ? (
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      name={`friday_${row.employeeId}`}
                      defaultChecked={row.workedFriday}
                      className="size-4"
                    />
                    اشتغل — يستحق قيمة يوم إضافي
                  </label>
                ) : (
                  <select
                    name={`status_${row.employeeId}`}
                    value={statuses[row.employeeId] ?? ATTENDANCE_STATUS.PRESENT}
                    onChange={(event) =>
                      setStatuses((current) => ({
                        ...current,
                        [row.employeeId]: event.target.value,
                      }))
                    }
                    className={inputClass}
                  >
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {ATTENDANCE_STATUS_LABEL[status]}
                      </option>
                    ))}
                  </select>
                )}
              </Td>
              <Td>
                <input
                  name={`note_${row.employeeId}`}
                  defaultValue={row.note}
                  className={inputClass}
                  placeholder="اختياري"
                />
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>

      <button type="submit" className={buttonClass} disabled={pending}>
        {pending ? "جاري الحفظ..." : "حفظ حضور اليوم"}
      </button>
    </form>
  );
}

export function ScheduleOverrideForm({
  action,
  date,
  employees,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  date: string;
  employees: Array<{ id: string; name: string }>;
}) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Alert>{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}

      <input type="hidden" name="date" value={date} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">
            الموظف
          </span>
          <select name="employeeId" className={inputClass} required>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">من</span>
          <input name="startTime" type="time" className={inputClass} required />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">إلى</span>
          <input name="endTime" type="time" className={inputClass} required />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">
            ملاحظة
          </span>
          <input name="note" className={inputClass} placeholder="اختياري" />
        </label>
      </div>

      <button type="submit" className={buttonSecondaryClass} disabled={pending}>
        {pending ? "جاري الحفظ..." : "حفظ مواعيد اليوم"}
      </button>
    </form>
  );
}
