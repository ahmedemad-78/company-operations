import { requireSuperAdmin } from "@/lib/auth";
import { Card, PageHeader } from "@/components/ui";
import { toDateInputValue } from "@/lib/format";
import { EmployeeForm } from "../employee-form";
import { createEmployee } from "../actions";

export default async function NewEmployeePage() {
  await requireSuperAdmin();

  return (
    <>
      <PageHeader
        title="إضافة موظف"
        description="المرتب الأساسي المُدخل هنا هو نقطة البداية، وأي تغيير بعد ذلك يُسجَّل في سجل المرتبات"
      />
      <Card className="max-w-3xl">
        <EmployeeForm
          mode="create"
          action={createEmployee}
          values={{
            name: "",
            jobTitle: "",
            basicSalary: 0,
            weeklyTransportAllowance: 0,
            startDate: toDateInputValue(new Date()),
            endDate: "",
            hasFixedSchedule: true,
            monthlyPaidLeaveDays: 1,
            note: "",
          }}
        />
      </Card>
    </>
  );
}
