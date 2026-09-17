/**
 * شكل الـTemplate النهائي لعرض السعر لسه Pending في الـBRD (بند 14 — في انتظار نسخة من عرض قديم
 * Word/PDF). التنسيق هنا متحفظ ومقصود إنه بسيط: كل أنماط الطباعة في متغير CSS واحد بأسفل
 * الملف بأسماء كلاسات واضحة، فتغيير الشكل النهائي لاحقًا يكون في مكان واحد بدون لمس المنطق.
 *
 * الطباعة والـPDF من محرك المتصفح نفسه (window.print) — لا توجد مكتبة PDF في المشروع،
 * وده اللي يضمن إن العربي يطلع صح.
 */

import Link from "next/link";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { QUOTATION_MODE, SETTING_KEYS } from "@/lib/constants";
import { formatDate, formatMoney } from "@/lib/format";
import { PrintButton } from "./print-button";

const COMPANY_SETTING_KEYS: string[] = [
  SETTING_KEYS.COMPANY_NAME,
  SETTING_KEYS.COMPANY_ADDRESS,
  SETTING_KEYS.COMPANY_PHONE,
];

async function loadQuotation(id: string) {
  return prisma.quotation.findFirst({
    where: { id, deletedAt: null },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const quotation = await prisma.quotation.findFirst({
    where: { id, deletedAt: null },
    select: { number: true, customerName: true },
  });

  // اسم الصفحة هو اسم ملف الـPDF الافتراضي عند الحفظ من المتصفح
  return {
    title: quotation
      ? `عرض سعر ${quotation.number} - ${quotation.customerName}`
      : "عرض سعر",
  };
}

export default async function QuotationPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // الصفحة خارج الـApp Shell، فالتحقق من الجلسة يتم هنا. المديرون لهم حق الطباعة (قرار BRD رقم 20).
  await requireUser();
  const { id } = await params;

  const quotation = await loadQuotation(id);
  if (!quotation) notFound();

  const settingRows = await prisma.setting.findMany({
    where: { key: { in: COMPANY_SETTING_KEYS } },
  });
  const settings = new Map(settingRows.map((row) => [row.key, row.value]));
  const companyName = settings.get(SETTING_KEYS.COMPANY_NAME)?.trim() || "";
  const companyAddress = settings.get(SETTING_KEYS.COMPANY_ADDRESS)?.trim() || "";
  const companyPhone = settings.get(SETTING_KEYS.COMPANY_PHONE)?.trim() || "";

  const isItems = quotation.mode === QUOTATION_MODE.ITEMS;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: printStyles }} />

      <div className="q-screen">
        <div className="q-toolbar q-no-print">
          <PrintButton />
          <Link href={`/quotations/${quotation.id}`} className="q-back">
            رجوع لعرض السعر
          </Link>
        </div>

        <div className="q-doc" dir="rtl">
          <header className="q-header">
            <div>
              <h1 className="q-company">{companyName || "—"}</h1>
              {companyAddress ? (
                <p className="q-company-line">{companyAddress}</p>
              ) : null}
              {companyPhone ? (
                <p className="q-company-line">
                  تليفون: <span className="q-num">{companyPhone}</span>
                </p>
              ) : null}
            </div>
            <div className="q-header-meta">
              <h2 className="q-doc-title">عرض سعر</h2>
              <p className="q-company-line">
                رقم العرض: <span className="q-num">{quotation.number}</span>
              </p>
              <p className="q-company-line">
                التاريخ: <span className="q-num">{formatDate(quotation.date)}</span>
              </p>
            </div>
          </header>

          <section className="q-section">
            <h3 className="q-section-title">بيانات العميل</h3>
            <table className="q-info">
              <tbody>
                <tr>
                  <th>الاسم</th>
                  <td>{quotation.customerName}</td>
                </tr>
                {quotation.customerCompany ? (
                  <tr>
                    <th>الشركة / الجهة</th>
                    <td>{quotation.customerCompany}</td>
                  </tr>
                ) : null}
                {quotation.customerPhone ? (
                  <tr>
                    <th>التليفون</th>
                    <td className="q-num">{quotation.customerPhone}</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </section>

          <section className="q-section">
            <h3 className="q-section-title">
              {isItems ? "البنود" : "وصف الأعمال"}
            </h3>

            {isItems ? (
              <table className="q-items">
                <thead>
                  <tr>
                    <th className="q-col-index">م</th>
                    <th>الوصف</th>
                    <th className="q-col-num">الكمية</th>
                    <th className="q-col-num">سعر الوحدة</th>
                    <th className="q-col-num">الإجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {quotation.items.map((item, index) => (
                    <tr key={item.id}>
                      <td className="q-num q-col-index">{index + 1}</td>
                      <td>{item.description}</td>
                      <td className="q-num q-col-num">
                        {formatMoney(item.quantity)}
                      </td>
                      <td className="q-num q-col-num">
                        {formatMoney(item.unitPrice)}
                      </td>
                      <td className="q-num q-col-num">
                        {formatMoney(item.lineTotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="q-lump">{quotation.lumpDescription || "—"}</p>
            )}
          </section>

          <section className="q-total-row">
            <span className="q-total-label">الإجمالي</span>
            <span className="q-total-value">
              <span className="q-num">{formatMoney(quotation.total)}</span> ج.م
            </span>
          </section>
          <p className="q-total-note">الأسعار نهائية بدون ضرائب.</p>

          {quotation.validityNote ? (
            <section className="q-section">
              <h3 className="q-section-title">صلاحية العرض</h3>
              <p className="q-note">{quotation.validityNote}</p>
            </section>
          ) : null}

          {quotation.terms ? (
            <section className="q-section">
              <h3 className="q-section-title">الشروط والملاحظات</h3>
              <p className="q-note">{quotation.terms}</p>
            </section>
          ) : null}
        </div>
      </div>
    </>
  );
}

/** أنماط ورقة العرض والطباعة — مكان واحد لتعديل الشكل النهائي لما يتحدد */
const printStyles = `
.q-screen {
  background: #f4f6fa;
  padding: 24px 16px 48px;
}
.q-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  max-width: 210mm;
  margin: 0 auto 16px;
}
.q-back {
  font-size: 14px;
  color: #334155;
  text-decoration: underline;
}
.q-doc {
  box-sizing: border-box;
  width: 100%;
  max-width: 210mm;
  min-height: 297mm;
  margin: 0 auto;
  padding: 18mm 16mm;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  color: #1f2937;
  font-size: 13px;
  line-height: 1.9;
  text-align: right;
}
.q-header {
  display: flex;
  justify-content: space-between;
  gap: 24px;
  padding-bottom: 12px;
  border-bottom: 2px solid #1f2937;
}
.q-header-meta { text-align: left; }
.q-company {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
}
.q-company-line {
  margin: 2px 0 0;
  font-size: 12px;
  color: #4b5563;
}
.q-doc-title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
}
.q-section { margin-top: 18px; }
.q-section-title {
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 700;
}
.q-info { border-collapse: collapse; }
.q-info th,
.q-info td {
  padding: 3px 0;
  font-size: 13px;
  font-weight: 400;
  text-align: right;
  vertical-align: top;
}
.q-info th {
  width: 120px;
  color: #6b7280;
}
.q-items {
  width: 100%;
  border-collapse: collapse;
}
.q-items th,
.q-items td {
  border: 1px solid #cbd5e1;
  padding: 6px 8px;
  font-size: 13px;
  text-align: right;
  vertical-align: top;
}
.q-items th {
  background: #f1f5f9;
  font-weight: 700;
}
.q-col-index { width: 36px; text-align: center; }
.q-col-num { width: 90px; }
.q-lump {
  margin: 0;
  white-space: pre-wrap;
  border: 1px solid #cbd5e1;
  padding: 10px 12px;
}
.q-total-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 18px;
  padding: 8px 12px;
  border: 2px solid #1f2937;
  font-size: 15px;
  font-weight: 700;
}
.q-total-note {
  margin: 6px 0 0;
  font-size: 11px;
  color: #6b7280;
}
.q-note {
  margin: 0;
  white-space: pre-wrap;
  font-size: 12px;
  color: #374151;
}
/* الأرقام اللاتينية داخل نص عربي */
.q-num {
  direction: ltr;
  unicode-bidi: embed;
  display: inline-block;
  font-variant-numeric: tabular-nums;
}

@media print {
  .q-no-print { display: none !important; }
  .q-screen {
    background: #ffffff;
    padding: 0;
  }
  .q-doc {
    max-width: none;
    min-height: 0;
    margin: 0;
    padding: 0;
    border: 0;
  }
  .q-items { page-break-inside: auto; }
  .q-items thead { display: table-header-group; }
  .q-items tr { page-break-inside: avoid; }
  .q-total-row { page-break-inside: avoid; }
  @page {
    size: A4;
    margin: 14mm;
  }
}
`;
