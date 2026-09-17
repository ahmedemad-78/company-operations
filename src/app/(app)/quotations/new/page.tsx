import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth";
import { Card, PageHeader } from "@/components/ui";
import { QUOTATION_MODE } from "@/lib/constants";
import { toDateInputValue } from "@/lib/format";
import { QuotationForm } from "../quotation-form";
import { createQuotation } from "../actions";

export default async function NewQuotationPage() {
  await requireSuperAdmin();

  // اقتراحات أسماء العملاء تأتي من العروض السابقة — لا يوجد Customer Module (قرار BRD رقم 23)
  const previousCustomers = await prisma.quotation.findMany({
    where: { deletedAt: null },
    select: { customerName: true },
    distinct: ["customerName"],
    orderBy: { customerName: "asc" },
  });

  return (
    <>
      <PageHeader
        title="عرض سعر جديد"
        description="رقم العرض يُكتب يدويًا، والأسعار نهائية بدون ضرائب"
      />
      <Card className="max-w-5xl">
        <QuotationForm
          mode="create"
          action={createQuotation}
          customerNames={previousCustomers.map((row) => row.customerName)}
          values={{
            number: "",
            date: toDateInputValue(new Date()),
            customerName: "",
            customerCompany: "",
            customerPhone: "",
            mode: QUOTATION_MODE.ITEMS,
            lumpDescription: "",
            lumpTotal: 0,
            validityNote: "",
            terms: "",
            items: [],
          }}
        />
      </Card>
    </>
  );
}
