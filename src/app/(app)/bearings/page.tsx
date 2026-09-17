import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import {
  Alert,
  Badge,
  Card,
  EmptyState,
  PageHeader,
  StatCard,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { BEARING_MOVEMENT_TYPE, BEARING_MOVEMENT_TYPE_LABEL } from "@/lib/constants";
import { formatDate, formatQuantity, toDateInputValue } from "@/lib/format";
import { MovementForm } from "./movement-form";
import { DeleteMovementButton } from "./delete-movement-button";
import { createBearingMovement } from "./actions";

export default async function BearingsPage() {
  await requireUser();

  // تصاعديًا عشان نحسب الرصيد بعد كل حركة، والعرض بالمقلوب (الأحدث أولًا)
  const movements = await prisma.bearingMovement.findMany({
    where: { deletedAt: null },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
  });

  const rows: ((typeof movements)[number] & { balance: number })[] = [];
  let running = 0;
  for (const movement of movements) {
    running +=
      movement.type === BEARING_MOVEMENT_TYPE.OUT
        ? -movement.quantity
        : movement.quantity;
    rows.push({ ...movement, balance: running });
  }

  const currentQuantity = running;
  const totalIn = movements
    .filter((m) => m.type !== BEARING_MOVEMENT_TYPE.OUT)
    .reduce((sum, m) => sum + m.quantity, 0);
  const totalOut = movements
    .filter((m) => m.type === BEARING_MOVEMENT_TYPE.OUT)
    .reduce((sum, m) => sum + m.quantity, 0);

  return (
    <>
      <PageHeader
        title="الرومان بلي"
        description="متابعة الكمية فقط — الرصيد الافتتاحي + الوارد − الاستخدام"
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="الكمية الحالية"
          value={`${formatQuantity(currentQuantity)} قطعة`}
          hint="الرصيد الافتتاحي + الوارد − الاستخدام"
          tone={currentQuantity > 0 ? "brand" : "negative"}
        />
        <StatCard
          label="إجمالي الوارد"
          value={`${formatQuantity(totalIn)} قطعة`}
          hint="شامل الرصيد الافتتاحي"
        />
        <StatCard
          label="إجمالي الاستخدام"
          value={`${formatQuantity(totalOut)} قطعة`}
        />
      </div>

      <div className="mb-6">
        <Alert tone="info">
          شراء الرومان بلي يتسجل هنا <strong>ككمية بس</strong> — المصروف نفسه يتسجل
          منفصل يدويًا في الخزنة. والنظام بيمنع أي حركة تخلي الكمية بالسالب.
        </Alert>
      </div>

      <div className="grid gap-6">
        <Card
          title="تسجيل حركة جديدة"
          description="متاح للمدير الإداري والمديرين — وكل حركة تتسجل في الـAudit Log"
        >
          <MovementForm
            action={createBearingMovement}
            mode="create"
            values={{
              type: BEARING_MOVEMENT_TYPE.IN,
              date: toDateInputValue(new Date()),
              quantity: "",
              note: null,
            }}
          />
        </Card>

        <Card
          title="سجل الحركات"
          description="الأحدث أولًا — الإلغاء لا يمسح الحركة نهائيًا"
        >
          {rows.length === 0 ? (
            <EmptyState message="لا توجد حركات مسجلة حتى الآن. ابدأ بتسجيل الرصيد الافتتاحي." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>التاريخ</Th>
                  <Th>نوع الحركة</Th>
                  <Th>الكمية</Th>
                  <Th>الرصيد بعد الحركة</Th>
                  <Th>ملاحظات</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {[...rows].reverse().map((movement) => {
                  const isOut = movement.type === BEARING_MOVEMENT_TYPE.OUT;
                  return (
                    <tr key={movement.id} className="hover:bg-slate-50">
                      <Td className="num">{formatDate(movement.date)}</Td>
                      <Td>
                        <Badge
                          tone={
                            isOut
                              ? "warning"
                              : movement.type === BEARING_MOVEMENT_TYPE.OPENING
                                ? "neutral"
                                : "success"
                          }
                        >
                          {BEARING_MOVEMENT_TYPE_LABEL[movement.type] ?? movement.type}
                        </Badge>
                      </Td>
                      <Td className="num font-medium text-slate-900">
                        {isOut ? "−" : "+"}
                        {formatQuantity(movement.quantity)}
                      </Td>
                      <Td className="num text-slate-500">
                        {formatQuantity(movement.balance)}
                      </Td>
                      <Td className="text-slate-500">{movement.note || "—"}</Td>
                      <Td>
                        <div className="flex items-start gap-3">
                          <Link
                            href={`/bearings/${movement.id}/edit`}
                            className="text-sm font-medium text-brand-600 hover:underline"
                          >
                            تعديل
                          </Link>
                          <DeleteMovementButton id={movement.id} />
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}
