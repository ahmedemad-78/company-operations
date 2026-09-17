import "server-only";

import { prisma } from "@/lib/prisma";
import { CASH_TYPE, CLOSING_STATUS, FUNDING_SOURCE } from "@/lib/constants";
import { addDays, formatDate, startOfDay } from "@/lib/format";
import { dateKey, eachDayBetween } from "@/lib/period";
import { getOpeningCashBalance, getSystemStartDate } from "@/lib/settings";

/**
 * حسابات الخزنة — المرجع الوحيد لأي شاشة تعرض رصيدًا.
 *
 * قرارات BRD المطبقة:
 *  - المصروف "من المدير شخصيًا" لا يدخل في معادلة الخزنة إطلاقًا (11.2).
 *  - Opening اليوم = Closing المحسوب لليوم السابق (11.5).
 *  - فرق الجرد يبقى منفصلًا ولا يُرحَّل (11.6).
 *  - اليوم المقفول لا يُعدَّل إلا بعد فتحه صراحة (11.7).
 *  - الإقفال بالترتيب إجباري (قرار 35).
 */

/** مجموع التحصيلات ومصروفات خزنة الشركة قبل تاريخ معين (لا يشمل اليوم نفسه) */
export async function openingBalanceFor(date: Date): Promise<number> {
  const day = startOfDay(date);
  const [openingCash, collections, expenses] = await Promise.all([
    getOpeningCashBalance(),
    prisma.cashTransaction.aggregate({
      where: { deletedAt: null, type: CASH_TYPE.COLLECTION, date: { lt: day } },
      _sum: { amount: true },
    }),
    prisma.cashTransaction.aggregate({
      where: {
        deletedAt: null,
        type: CASH_TYPE.EXPENSE,
        fundingSource: FUNDING_SOURCE.COMPANY_CASH,
        date: { lt: day },
      },
      _sum: { amount: true },
    }),
  ]);

  return openingCash + (collections._sum.amount ?? 0) - (expenses._sum.amount ?? 0);
}

export type DayFigures = {
  date: Date;
  openingBalance: number;
  collectionsTotal: number;
  /** مصروفات خزنة الشركة فقط */
  expensesTotal: number;
  /** مصروفات صرفها المدير من ماله الخاص — للعلم فقط، خارج رصيد الخزنة */
  managerPaidTotal: number;
  calculatedClosing: number;
};

export async function dayFigures(date: Date): Promise<DayFigures> {
  const day = startOfDay(date);
  const next = addDays(day, 1);
  const range = { gte: day, lt: next };

  const [openingBalance, collections, expenses, managerPaid] = await Promise.all([
    openingBalanceFor(day),
    prisma.cashTransaction.aggregate({
      where: { deletedAt: null, type: CASH_TYPE.COLLECTION, date: range },
      _sum: { amount: true },
    }),
    prisma.cashTransaction.aggregate({
      where: {
        deletedAt: null,
        type: CASH_TYPE.EXPENSE,
        fundingSource: FUNDING_SOURCE.COMPANY_CASH,
        date: range,
      },
      _sum: { amount: true },
    }),
    prisma.cashTransaction.aggregate({
      where: {
        deletedAt: null,
        type: CASH_TYPE.EXPENSE,
        fundingSource: FUNDING_SOURCE.MANAGER_PERSONAL,
        date: range,
      },
      _sum: { amount: true },
    }),
  ]);

  const collectionsTotal = collections._sum.amount ?? 0;
  const expensesTotal = expenses._sum.amount ?? 0;

  return {
    date: day,
    openingBalance,
    collectionsTotal,
    expensesTotal,
    managerPaidTotal: managerPaid._sum.amount ?? 0,
    calculatedClosing: openingBalance + collectionsTotal - expensesTotal,
  };
}

/** رصيد الخزنة الحالي = إقفال اليوم الحالي المحسوب */
export async function currentCashBalance(): Promise<number> {
  const figures = await dayFigures(new Date());
  return figures.calculatedClosing;
}

/**
 * أي حركة في يوم مقفول ممنوعة حتى يفتحه الـSuper Admin صراحةً (BRD 11.7).
 * تُستدعى من كل Server Action يضيف أو يعدل أو يلغي حركة خزنة.
 */
export async function assertDayEditable(date: Date): Promise<void> {
  const day = startOfDay(date);
  const closing = await prisma.dailyClosing.findUnique({ where: { date: day } });
  if (closing?.status === CLOSING_STATUS.CLOSED) {
    throw new Error(
      `يوم ${formatDate(day)} مقفول. افتح الإقفال أولًا من شاشة الإقفال اليومي ثم عدِّل الحركة.`,
    );
  }

  const systemStart = await getSystemStartDate();
  if (day.getTime() < systemStart.getTime()) {
    throw new Error(
      `لا يمكن تسجيل حركة قبل تاريخ بداية بيانات النظام (${formatDate(systemStart)}).`,
    );
  }
}

/**
 * أقدم يوم مطلوب إقفاله قبل تاريخ معين. تُستخدم لمنع الإقفال خارج الترتيب (قرار 35)
 * وللتنبيه على الأيام المنسية.
 */
export async function oldestUnclosedDayBefore(date: Date): Promise<Date | null> {
  const day = startOfDay(date);

  const [firstTransaction, firstClosing] = await Promise.all([
    prisma.cashTransaction.findFirst({
      where: { deletedAt: null },
      orderBy: { date: "asc" },
      select: { date: true },
    }),
    prisma.dailyClosing.findFirst({
      orderBy: { date: "asc" },
      select: { date: true },
    }),
  ]);

  const candidates = [firstTransaction?.date, firstClosing?.date].filter(
    (value): value is Date => Boolean(value),
  );
  if (candidates.length === 0) return null;

  const chainStart = startOfDay(
    candidates.reduce((earliest, current) =>
      current.getTime() < earliest.getTime() ? current : earliest,
    ),
  );
  if (chainStart.getTime() >= day.getTime()) return null;

  const closings = await prisma.dailyClosing.findMany({
    where: { date: { gte: chainStart, lt: day }, status: CLOSING_STATUS.CLOSED },
    select: { date: true },
  });
  const closedKeys = new Set(closings.map((row) => dateKey(row.date)));

  for (const candidate of eachDayBetween(chainStart, addDays(day, -1))) {
    if (!closedKeys.has(dateKey(candidate))) return candidate;
  }
  return null;
}

/** الأيام المفتوحة حتى اليوم — تُعرض كتنبيه في شاشة الإقفال ولوحة التحكم */
export async function openDaysUntilToday(limit = 15): Promise<Date[]> {
  const today = startOfDay(new Date());
  const [firstTransaction, firstClosing] = await Promise.all([
    prisma.cashTransaction.findFirst({
      where: { deletedAt: null },
      orderBy: { date: "asc" },
      select: { date: true },
    }),
    prisma.dailyClosing.findFirst({
      orderBy: { date: "asc" },
      select: { date: true },
    }),
  ]);

  const candidates = [firstTransaction?.date, firstClosing?.date].filter(
    (value): value is Date => Boolean(value),
  );
  if (candidates.length === 0) return [];

  const chainStart = startOfDay(
    candidates.reduce((earliest, current) =>
      current.getTime() < earliest.getTime() ? current : earliest,
    ),
  );

  const closings = await prisma.dailyClosing.findMany({
    where: { date: { gte: chainStart, lte: today }, status: CLOSING_STATUS.CLOSED },
    select: { date: true },
  });
  const closedKeys = new Set(closings.map((row) => dateKey(row.date)));

  const open: Date[] = [];
  for (const candidate of eachDayBetween(chainStart, today)) {
    if (!closedKeys.has(dateKey(candidate))) open.push(candidate);
    if (open.length >= limit) break;
  }
  return open;
}
