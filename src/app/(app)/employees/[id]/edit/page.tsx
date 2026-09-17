import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth";
import { Card, PageHeader } from "@/components/ui";
import { toDateInputValue } from "@/lib/format";
import { EmployeeForm } from "../../employee-form";
import { updateEmployee } from "../../actions";

export default async function EditEmployeePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSuperAdmin();
  const { id } = await params;

  const employee = await prisma.employee.findFirst({
    where: { id, deletedAt: null },
  });
  if (!employee) notFound();

  return (
    <>
      <PageHeader title={`تعديل بيانات ${employee.name}`} />
      <Card className="max-w-3xl">
        <EmployeeForm
          mode="edit"
          action={updateEmployee}
          values={{
            id: employee.id,
            name: employee.name,
            jobTitle: employee.jobTitle,
            basicSalary: employee.basicSalary,
            weeklyTransportAllowance: employee.weeklyTransportAllowance,
            startDate: toDateInputValue(employee.startDate),
            endDate: employee.endDate ? toDateInputValue(employee.endDate) : "",
            hasFixedSchedule: employee.hasFixedSchedule,
            monthlyPaidLeaveDays: employee.monthlyPaidLeaveDays,
            note: employee.note,
          }}
        />
      </Card>
    </>
  );
}
