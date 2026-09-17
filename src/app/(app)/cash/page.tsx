import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { getCurrentUser, isSuperAdmin, requireUser } from "@/lib/auth";
import { dayFigures } from "@/lib/cash";
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
  buttonDangerClass,
  buttonSecondaryClass,
  inputClass,
} from "@/components/ui";
import {
  CASH_ORIGIN,
  CASH_ORIGIN_LABEL,
  CASH_TYPE,
  CLOSING_STATUS,
  FUNDING_SOURCE,
  FUNDING_SOURCE_LABEL,
} from "@/lib/constants";
import {
  addDays,
  formatDateWithWeekday,
  formatMoney,
  startOfDay,
  toDateInputValue,
} from "@/lib/format";
import { TransactionForm } from "./cash-forms";
import { createTransaction, deleteTransaction, updateTransaction } from "./actions";

export default async function CashPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  await requireUser();
  const user = await getCurrentUser();
  const canEdit = isSuperAdmin(user);

  const { date: dateParam } = await searchParams;
  const day = startOfDay(dateParam || new Date());
  const dayValue = toDateInputValue(day);

  const [figures, transactions, closing] = await Promise.all([
    dayFigures(day),
    prisma.cashTransaction.findMany({
      where: {
        deletedAt: null,
        date: { gte: day, lt: addDays(day, 1) },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.dailyClosing.findUnique({ where: { date: day } }),
  ]);

  const collections = transactions.filter((row) => row.type === CASH_TYPE.COLLECTION);
  const expenses = transactions.filter((row) => row.type === CASH_TYPE.EXPENSE);
  const isClosed = closing?.status === CLOSING_STATUS.CLOSED;
  const editable = canEdit && !isClosed;

  const emptyValues = {
    date: dayValue,
    amount: "" as const,
    counterparty: "",
    fundingSource: FUNDING_SOURCE.COMPANY_CASH,
    note: "",
  };

  return (
    <>
      <PageHeader
        title="التحصيلات والمصروفات"
        description="كل حركة تُسجَّل مستقلة، وتدخل مباشرة في إقفال اليوم"
        actions={
          <Link href={`/closing?date=${dayValue}`} className={buttonSecondaryClass}>
            إقفال هذا اليوم
          </Link>
        }
      />

      <Card className="mb-6">
        <form className="flex flex-wrap items-end gap-3">
          <div className="min-w-48">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">
              اليوم
            </span>
            <input
              name="date"
              type="date"
              defaultValue={dayValue}
              className={inputClass}
            />
          </div>
          <button type="submit" className={buttonSecondaryClass}>
            عرض
          </button>
          <div className="flex items-center gap-2">
            <Link
              href={`/cash?date=${toDateInputValue(addDays(day, -1))}`}
              className={buttonSecondaryClass}
            >
              اليوم السابق
            </Link>
            <Link
              href={`/cash?date=${toDateInputValue(addDays(day, 1))}`}
              className={buttonSecondaryClass}
            >
              اليوم التالي
            </Link>
          </div>
          <p className="ms-auto text-sm text-slate-500">
            {formatDateWithWeekday(day)}
            {isClosed ? <Badge tone="warning">مقفول</Badge> : null}
          </p>
        </form>
      </Card>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="رصيد أول اليوم"
          value={`${formatMoney(figures.openingBalance)} ج.م`}
        />
        <StatCard
          label="تحصيلات اليوم"
          value={`${formatMoney(figures.collectionsTotal)} ج.م`}
          tone="positive"
        />
        <StatCard
          label="مصروفات اليوم"
          value={`${formatMoney(figures.expensesTotal)} ج.م`}
          tone="negative"
          hint="من خزنة الشركة فقط"
        />
        <StatCard
          label="رصيد آخر اليوم (محسوب)"
          value={`${formatMoney(figures.calculatedClosing)} ج.م`}
          tone="brand"
        />
      </div>

      {figures.managerPaidTotal > 0 ? (
        <div className="mb-6">
          <Alert tone="info">
            مصروفات صرفها المدير من ماله الخاص اليوم:{" "}
            {formatMoney(figures.managerPaidTotal)} ج.م — خارج رصيد الخزنة ولا تدخل في
            الإقفال.
          </Alert>
        </div>
      ) : null}

      {isClosed && canEdit ? (
        <div className="mb-6">
          <Alert tone="info">
            هذا اليوم مقفول. لتعديل أي حركة، افتح الإقفال أولًا من{" "}
            <Link href={`/closing?date=${dayValue}`} className="underline">
              شاشة الإقفال اليومي
            </Link>
            .
          </Alert>
        </div>
      ) : null}

      {editable ? (
        <div className="mb-6 grid gap-6 lg:grid-cols-2">
          <Card title="تسجيل تحصيل">
            <TransactionForm
              action={createTransaction}
              type={CASH_TYPE.COLLECTION}
              values={emptyValues}
              submitLabel="تسجيل التحصيل"
            />
          </Card>
          <Card title="تسجيل مصروف">
            <TransactionForm
              action={createTransaction}
              type={CASH_TYPE.EXPENSE}
              values={emptyValues}
              submitLabel="تسجيل المصروف"
            />
          </Card>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={`التحصيلات (${collections.length})`}>
          {collections.length === 0 ? (
            <EmptyState message="لا توجد تحصيلات في هذا اليوم." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>الجهة</Th>
                  <Th className="w-28">المبلغ</Th>
                  <Th>ملاحظة</Th>
                  {editable ? <Th className="w-28" /> : null}
                </tr>
              </thead>
              <tbody>
                {collections.map((row) => (
                  <tr key={row.id} className="align-top">
                    <Td>{row.counterparty}</Td>
                    <Td className="num whitespace-nowrap text-emerald-700">
                      {formatMoney(row.amount)}
                    </Td>
                    <Td className="text-xs text-slate-500">{row.note || "—"}</Td>
                    {editable ? (
                      <Td>
                        <RowActions
                          id={row.id}
                          type={CASH_TYPE.COLLECTION}
                          values={{
                            id: row.id,
                            date: toDateInputValue(row.date),
                            amount: row.amount,
                            counterparty: row.counterparty,
                            fundingSource: row.fundingSource,
                            note: row.note ?? "",
                          }}
                          origin={row.origin}
                        />
                      </Td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <Card title={`المصروفات (${expenses.length})`}>
          {expenses.length === 0 ? (
            <EmptyState message="لا توجد مصروفات في هذا اليوم." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>الوصف</Th>
                  <Th className="w-28">المبلغ</Th>
                  <Th>مصدر الصرف</Th>
                  {editable ? <Th className="w-28" /> : null}
                </tr>
              </thead>
              <tbody>
                {expenses.map((row) => (
                  <tr key={row.id} className="align-top">
                    <Td>
                      {row.counterparty}
                      {row.origin !== CASH_ORIGIN.MANUAL ? (
                        <span className="mt-1 block text-[11px] text-slate-400">
                          {CASH_ORIGIN_LABEL[row.origin] ?? row.origin} — أنشأها النظام
                        </span>
                      ) : null}
                      {row.note ? (
                        <span className="mt-1 block text-xs text-slate-500">
                          {row.note}
                        </span>
                      ) : null}
                    </Td>
                    <Td className="num whitespace-nowrap text-rose-700">
                      {formatMoney(row.amount)}
                    </Td>
                    <Td>
                      <Badge
                        tone={
                          row.fundingSource === FUNDING_SOURCE.COMPANY_CASH
                            ? "neutral"
                            : "info"
                        }
                      >
                        {FUNDING_SOURCE_LABEL[row.fundingSource] ?? row.fundingSource}
                      </Badge>
                    </Td>
                    {editable ? (
                      <Td>
                        <RowActions
                          id={row.id}
                          type={CASH_TYPE.EXPENSE}
                          values={{
                            id: row.id,
                            date: toDateInputValue(row.date),
                            amount: row.amount,
                            counterparty: row.counterparty,
                            fundingSource: row.fundingSource,
                            note: row.note ?? "",
                          }}
                          origin={row.origin}
                        />
                      </Td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}

function RowActions({
  id,
  type,
  values,
  origin,
}: {
  id: string;
  type: string;
  values: {
    id: string;
    date: string;
    amount: number;
    counterparty: string;
    fundingSource: string;
    note: string;
  };
  origin: string;
}) {
  if (origin !== CASH_ORIGIN.MANUAL) {
    return <span className="text-xs text-slate-400">من النظام</span>;
  }

  return (
    <details>
      <summary className="cursor-pointer text-xs text-blue-600">تعديل</summary>
      <div className="mt-3 space-y-3 rounded-lg border border-slate-200 p-3">
        <TransactionForm
          action={updateTransaction}
          type={type}
          values={values}
          submitLabel="حفظ التعديل"
          layout="stacked"
        />
        <form action={deleteTransaction}>
          <input type="hidden" name="id" value={id} />
          <button type="submit" className={buttonDangerClass}>
            إلغاء الحركة
          </button>
        </form>
      </div>
    </details>
  );
}
