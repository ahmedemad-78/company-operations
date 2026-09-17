import Link from "next/link";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { Card, PageHeader, StatCard, buttonSecondaryClass } from "@/components/ui";
import { BEARING_MOVEMENT_TYPE, BEARING_MOVEMENT_TYPE_LABEL } from "@/lib/constants";
import { formatDate, formatQuantity, toDateInputValue } from "@/lib/format";
import { MovementForm } from "../../movement-form";
import { DeleteMovementButton } from "../../delete-movement-button";
import { updateBearingMovement } from "../../actions";

export default async function EditBearingMovementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireUser();

  const movement = await prisma.bearingMovement.findFirst({
    where: { id, deletedAt: null },
  });
  if (!movement) notFound();

  const movements = await prisma.bearingMovement.findMany({
    where: { deletedAt: null },
    select: { type: true, quantity: true },
  });
  const currentQuantity = movements.reduce(
    (sum, m) =>
      sum + (m.type === BEARING_MOVEMENT_TYPE.OUT ? -m.quantity : m.quantity),
    0,
  );

  return (
    <>
      <PageHeader
        title="تعديل حركة رومان بلي"
        description={`${BEARING_MOVEMENT_TYPE_LABEL[movement.type] ?? movement.type} — ${formatQuantity(movement.quantity)} قطعة بتاريخ ${formatDate(movement.date)}`}
        actions={
          <Link href="/bearings" className={buttonSecondaryClass}>
            رجوع للسجل
          </Link>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="الكمية الحالية"
          value={`${formatQuantity(currentQuantity)} قطعة`}
          hint="التعديل ممنوع لو هينزل بالكمية تحت الصفر"
          tone={currentQuantity > 0 ? "brand" : "negative"}
        />
      </div>

      <div className="grid gap-6">
        <Card
          title="بيانات الحركة"
          description="التعديل يتسجل في الـAudit Log بالقيمة القديمة والجديدة"
        >
          <MovementForm
            action={updateBearingMovement}
            mode="edit"
            values={{
              id: movement.id,
              type: movement.type,
              date: toDateInputValue(movement.date),
              quantity: movement.quantity,
              note: movement.note,
            }}
          />
        </Card>

        <Card title="إجراءات" description="الإلغاء لا يمسح الحركة نهائيًا">
          <DeleteMovementButton
            id={movement.id}
            label="إلغاء الحركة"
            redirectTo="/bearings"
          />
        </Card>
      </div>
    </>
  );
}
