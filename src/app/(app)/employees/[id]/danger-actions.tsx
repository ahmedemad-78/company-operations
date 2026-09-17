"use client";

import { buttonDangerClass, buttonSecondaryClass } from "@/components/ui";
import { deleteEmployee, toggleEmployeeStatus } from "../actions";

export function EmployeeDangerActions({
  employeeId,
  isActive,
}: {
  employeeId: string;
  isActive: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <form action={toggleEmployeeStatus}>
        <input type="hidden" name="id" value={employeeId} />
        <button type="submit" className={buttonSecondaryClass}>
          {isActive ? "إيقاف الموظف (Inactive)" : "إعادة تشغيل الموظف (Active)"}
        </button>
      </form>

      <form
        action={deleteEmployee}
        onSubmit={(event) => {
          if (
            !window.confirm(
              "سيتم إلغاء الموظف وإخفاؤه من الشاشات مع الاحتفاظ بكل بياناته وسجلاته. هل تريد المتابعة؟",
            )
          ) {
            event.preventDefault();
          }
        }}
      >
        <input type="hidden" name="id" value={employeeId} />
        <button type="submit" className={buttonDangerClass}>
          إلغاء الموظف
        </button>
      </form>
    </div>
  );
}
