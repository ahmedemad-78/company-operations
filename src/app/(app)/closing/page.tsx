import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { getCurrentUser, isSuperAdmin, requireUser } from "@/lib/auth";
import { dayFigures, oldestUnclosedDayBefore, openDaysUntilToday } from "@/lib/cash";
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
  buttonSecondaryClass,
  inputClass,
} from "@/components/ui";
import { CASH_TYPE, CLOSING_STATUS } from "@/lib/constants";
import {
  addDays,
  formatDate,
  formatDateTime,
  formatDateWithWeekday,
  formatMoney,
  startOfDay,
  toDateInputValue,
} from "@/lib/format";
import { ClosingForm } from "./closing-form";
import { closeDay, reopenDay } from "./actions";

function differenceBadge(difference: number) {
  if (difference === 0) return <Badge tone="success">مطابق</Badge>;
  if (difference < 0) {
    return <Badge tone="danger">عجز {formatMoney(Math.abs(difference))}</Badge>;
  }
  return <Badge tone="warning">زيادة {formatMoney(difference)}</Badge>;
}

export default async function ClosingPage({
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

  const [figures, closing, transactions, recent, openDays, pendingDay] =
    await Promise.all([
      dayFigures(day),
      prisma.dailyClosing.findUnique({ where: { date: day } }),
      prisma.cashTransaction.findMany({
        where: { deletedAt: null, date: { gte: day, lt: addDays(day, 1) } },
        orderBy: { createdAt: "asc" },
      }),
      prisma.dailyClosing.findMany({
        orderBy: { date: "desc" },
        take: 30,
      }),
      openDaysUntilToday(),
      oldestUnclosedDayBefore(day),
    ]);

  const isClosed = closing?.status === CLOSING_STATUS.CLOSED;
  const isFuture = day.getTime() > startOfDay(new Date()).getTime();

  return (
    <>
      <PageHeader
        title="الإقفال اليومي"
        description="رصيد أول اليوم + التحصيلات − المصروفات = الرصيد المحسوب، ثم يُقارن بالرصيد الفعلي"
        actions={
          <Link href={`/cash?date=${dayValue}`} className={buttonSecondaryClass}>
            حركات هذا اليوم
          </Link>
        }
      />

      {openDays.length > 0 ? (
        <div className="mb-6">
          <Alert tone="info">
            أيام لسه مفتوحة ومحتاجة إقفال:{" "}
            {openDays.map((date, index) => (
              <span key={date.toISOString()}>
                {index > 0 ? "، " : ""}
                <Link
                  href={`/closing?date=${toDateInputValue(date)}`}
                  className="underline"
                >
                  {formatDate(date)}
                </Link>
              </span>
            ))}
          </Alert>
        </div>
      ) : null}

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
          <Link
            href={`/closing?date=${toDateInputValue(addDays(day, -1))}`}
            className={buttonSecondaryClass}
          >
            اليوم السابق
          </Link>
          <Link
            href={`/closing?date=${toDateInputValue(addDays(day, 1))}`}
            className={buttonSecondaryClass}
          >
            اليوم التالي
          </Link>
          <p className="ms-auto flex items-center gap-2 text-sm text-slate-500">
            {formatDateWithWeekday(day)}
            {isClosed ? <Badge tone="warning">مقفول</Badge> : null}
          </p>
        </form>
      </Card>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          label="رصيد أول اليوم"
          value={`${formatMoney(figures.openingBalance)} ج.م`}
        />
        <StatCard
          label="التحصيلات"
          value={`${formatMoney(figures.collectionsTotal)} ج.م`}
          tone="positive"
        />
        <StatCard
          label="المصروفات"
          value={`${formatMoney(figures.expensesTotal)} ج.م`}
          tone="negative"
        />
        <StatCard
          label="الرصيد المحسوب"
          value={`${formatMoney(figures.calculatedClosing)} ج.م`}
          tone="brand"
        />
        <StatCard
          label="الرصيد الفعلي"
          value={
            isClosed ? `${formatMoney(closing?.actualCash ?? 0)} ج.م` : "لم يُسجَّل"
          }
          tone={
            isClosed && (closing?.difference ?? 0) !== 0 ? "negative" : "neutral"
          }
          hint={
            isClosed && closing
              ? closing.difference === 0
                ? "مطابق للمحسوب"
                : closing.difference < 0
                  ? `عجز ${formatMoney(Math.abs(closing.difference))} ج.م`
                  : `زيادة ${formatMoney(closing.difference)} ج.م`
              : undefined
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="إقفال اليوم">
          {isFuture ? (
            <Alert tone="info">لا يمكن إقفال يوم في المستقبل.</Alert>
          ) : isClosed ? (
            <div className="space-y-4">
              <Alert tone="success">
                تم إقفال هذا اليوم في {formatDateTime(closing?.closedAt)}.
              </Alert>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-slate-500">الرصيد المحسوب</dt>
                  <dd className="num mt-1 text-slate-800">
                    {formatMoney(closing?.calculatedClosing ?? 0)} ج.م
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">الرصيد الفعلي</dt>
                  <dd className="num mt-1 text-slate-800">
                    {formatMoney(closing?.actualCash ?? 0)} ج.م
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">الفرق</dt>
                  <dd className="mt-1">
                    {differenceBadge(closing?.difference ?? 0)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">سبب الفرق</dt>
                  <dd className="mt-1 text-slate-800">
                    {closing?.differenceNote || "—"}
                  </dd>
                </div>
              </dl>
              {(closing?.reopenCount ?? 0) > 0 ? (
                <p className="text-xs text-amber-600">
                  تم فتح هذا اليوم {closing?.reopenCount} مرة — مسجل في سجل التغييرات.
                </p>
              ) : null}
              {canEdit ? (
                <form action={reopenDay}>
                  <input type="hidden" name="id" value={closing?.id} />
                  <button type="submit" className={buttonSecondaryClass}>
                    فتح الإقفال للتعديل
                  </button>
                </form>
              ) : null}
            </div>
          ) : !canEdit ? (
            <Alert tone="info">اليوم لسه مفتوح — الإقفال من صلاحية المدير الإداري.</Alert>
          ) : pendingDay ? (
            <Alert>
              لازم تقفل يوم{" "}
              <Link
                href={`/closing?date=${toDateInputValue(pendingDay)}`}
                className="underline"
              >
                {formatDate(pendingDay)}
              </Link>{" "}
              الأول — الإقفال لازم يكون بالترتيب عشان الرصيد يترحَّل صح.
            </Alert>
          ) : (
            <ClosingForm
              action={closeDay}
              date={dayValue}
              calculatedClosing={figures.calculatedClosing}
              defaultActualCash={figures.calculatedClosing}
              defaultNote=""
            />
          )}
        </Card>

        <Card title={`حركات اليوم (${transactions.length})`}>
          {transactions.length === 0 ? (
            <EmptyState message="لا توجد حركات في هذا اليوم." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>النوع</Th>
                  <Th>الجهة / الوصف</Th>
                  <Th className="w-28">المبلغ</Th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((row) => (
                  <tr key={row.id}>
                    <Td>
                      <Badge
                        tone={row.type === CASH_TYPE.COLLECTION ? "success" : "danger"}
                      >
                        {row.type === CASH_TYPE.COLLECTION ? "تحصيل" : "مصروف"}
                      </Badge>
                    </Td>
                    <Td>{row.counterparty}</Td>
                    <Td className="num whitespace-nowrap">{formatMoney(row.amount)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>

      <Card title="آخر الإقفالات" className="mt-6">
        {recent.length === 0 ? (
          <EmptyState message="لا توجد إقفالات مسجلة بعد." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>اليوم</Th>
                <Th className="w-28">أول اليوم</Th>
                <Th className="w-28">تحصيلات</Th>
                <Th className="w-28">مصروفات</Th>
                <Th className="w-28">المحسوب</Th>
                <Th className="w-28">الفعلي</Th>
                <Th className="w-32">الفرق</Th>
                <Th className="w-24">الحالة</Th>
              </tr>
            </thead>
            <tbody>
              {recent.map((row) => (
                <tr key={row.id}>
                  <Td className="whitespace-nowrap">
                    <Link
                      href={`/closing?date=${toDateInputValue(row.date)}`}
                      className="text-blue-600 hover:underline"
                    >
                      {formatDate(row.date)}
                    </Link>
                  </Td>
                  <Td className="num">{formatMoney(row.openingBalance)}</Td>
                  <Td className="num text-emerald-700">
                    {formatMoney(row.collectionsTotal)}
                  </Td>
                  <Td className="num text-rose-700">
                    {formatMoney(row.expensesTotal)}
                  </Td>
                  <Td className="num">{formatMoney(row.calculatedClosing)}</Td>
                  <Td className="num">
                    {row.status === CLOSING_STATUS.CLOSED
                      ? formatMoney(row.actualCash)
                      : "—"}
                  </Td>
                  <Td>
                    {row.status === CLOSING_STATUS.CLOSED
                      ? differenceBadge(row.difference)
                      : "—"}
                  </Td>
                  <Td>
                    {row.status === CLOSING_STATUS.CLOSED ? (
                      <Badge tone="neutral">مقفول</Badge>
                    ) : (
                      <Badge tone="warning">مفتوح</Badge>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
