import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth";
import { Card, PageHeader } from "@/components/ui";
import { toDateInputValue } from "@/lib/format";
import { QuotationForm } from "../../quotation-form";
import { updateQuotation } from "../../actions";

export default async function EditQuotationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSuperAdmin();
  const { id } = await params;

  const quotation = await prisma.quotation.findFirst({
    where: { id, deletedAt: null },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
  if (!quotation) notFound();

  const previousCustomers = await prisma.quotation.findMany({
    where: { deletedAt: null },
    select: { customerName: true },
    distinct: ["customerName"],
    orderBy: { customerName: "asc" },
  });

  return (
    <>
      <PageHeader title={`تعديل عرض السعر ${quotation.number}`} />
      <Card className="max-w-5xl">
        <QuotationForm
          mode="edit"
          action={updateQuotation}
          customerNames={previousCustomers.map((row) => row.customerName)}
          values={{
            id: quotation.id,
            number: quotation.number,
            date: toDateInputValue(quotation.date),
            customerName: quotation.customerName,
            customerCompany: quotation.customerCompany ?? "",
            customerPhone: quotation.customerPhone ?? "",
            mode: quotation.mode,
            lumpDescription: quotation.lumpDescription ?? "",
            lumpTotal: quotation.total,
            validityNote: quotation.validityNote ?? "",
            terms: quotation.terms ?? "",
            items: quotation.items.map((item) => ({
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
            })),
          }}
        />
      </Card>
    </>
  );
}
