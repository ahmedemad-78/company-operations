/**
 * بيانات تجريبية للعرض والتجربة — لا تُشغَّل على بيانات حقيقية.
 * التشغيل: npm run db:demo
 *
 * تنشئ: موظفين، حضور، حوافز وخصومات، سلف، حركات خزنة، إقفالات يومية،
 * كمية رومان بلي، وعرض سعر — كلها متسقة مع قواعد الـBRD.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return startOfDay(d);
}

function isFriday(date: Date): boolean {
  return date.getDay() === 5;
}

function dateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const EMPLOYEES = [
  { name: "أحمد سعيد", jobTitle: "فني موتورات أول", basicSalary: 9000, transport: 250 },
  { name: "محمود عبد الله", jobTitle: "فني موتورات", basicSalary: 7500, transport: 250 },
  { name: "كريم فتحي", jobTitle: "فني لف مواتير", basicSalary: 7000, transport: 250 },
  { name: "مصطفى رزق", jobTitle: "مساعد فني", basicSalary: 5500, transport: 200 },
  { name: "عمرو الشناوي", jobTitle: "سائق ومندوب تسليم", basicSalary: 6000, transport: 300 },
  { name: "هاني جمال", jobTitle: "أمين مخزن", basicSalary: 6500, transport: 200 },
  { name: "شريف منير", jobTitle: "محاسب", basicSalary: 8000, transport: 250 },
  { name: "طارق إبراهيم", jobTitle: "مدير إداري", basicSalary: 12000, transport: 400 },
];

const COLLECTION_SOURCES = [
  "شركة النور للصناعات",
  "مصنع الدلتا",
  "ورشة الحرفيين",
  "شركة المصرية للمياه",
  "مؤسسة البركة",
];

const EXPENSE_ITEMS = [
  "قطع غيار موتور",
  "بنزين وانتقالات",
  "أدوات ورشة",
  "كهرباء الورشة",
  "مشتريات نحاس لف",
  "صيانة عربية",
];

async function main() {
  const existing = await prisma.employee.count({ where: { deletedAt: null } });
  if (existing > 0 && !process.argv.includes("--force")) {
    console.log(
      `يوجد ${existing} موظف بالفعل — تم تخطي البيانات التجريبية. استخدم --force للتشغيل رغم ذلك.`,
    );
    return;
  }

  const today = startOfDay(new Date());
  const systemStart = startOfDay(
    new Date(today.getFullYear(), today.getMonth() - 1, 1),
  );

  // 1) الإعدادات
  const settings: Array<[string, string]> = [
    ["COMPANY_NAME", "شركة الشرق لخدمات الموتورات"],
    ["COMPANY_ADDRESS", "المنطقة الصناعية — القاهرة"],
    ["COMPANY_PHONE", "01001234567 - 0223456789"],
    ["SYSTEM_START_DATE", dateKey(systemStart)],
    ["OPENING_CASH_BALANCE", "14000"],
    ["WORK_START", "09:00"],
    ["WORK_END", "19:00"],
  ];
  for (const [key, value] of settings) {
    await prisma.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }

  // 2) الموظفون
  const employees = [];
  for (const row of EMPLOYEES) {
    const isAdmin = row.jobTitle === "مدير إداري";
    const employee = await prisma.employee.create({
      data: {
        name: row.name,
        jobTitle: row.jobTitle,
        basicSalary: row.basicSalary,
        weeklyTransportAllowance: row.transport,
        startDate: startOfDay(new Date(today.getFullYear() - 2, 0, 15)),
        hasFixedSchedule: !isAdmin,
        monthlyPaidLeaveDays: isAdmin ? 2 : 1,
        status: "ACTIVE",
      },
    });
    employees.push(employee);
  }

  // 3) عطلة رسمية داخل الشهر الحالي (لو لسه جاية أو فاتت)
  const holidayDate = startOfDay(
    new Date(today.getFullYear(), today.getMonth(), 12),
  );
  if (!isFriday(holidayDate)) {
    await prisma.companyHoliday.upsert({
      where: { date: holidayDate },
      update: { name: "عطلة رسمية" },
      create: { date: holidayDate, name: "عطلة رسمية" },
    });
  }

  const holidayKeys = new Set(
    (await prisma.companyHoliday.findMany({ where: { deletedAt: null } })).map(
      (row) => dateKey(row.date),
    ),
  );

  // 4) الحضور لآخر 24 يوم
  for (let offset = 24; offset >= 0; offset -= 1) {
    const date = addDays(today, -offset);
    if (date < systemStart) continue;

    for (const [index, employee] of employees.entries()) {
      if (isFriday(date)) {
        // الجمعة عطلة — عدا حالة واحدة: فني اشتغل جمعة واحدة
        if (index === 0 && offset === 5) {
          await prisma.attendance.create({
            data: {
              employeeId: employee.id,
              date,
              status: "PRESENT",
              workedFriday: true,
              note: "شغل طارئ لعميل",
            },
          });
        }
        continue;
      }
      if (holidayKeys.has(dateKey(date))) continue;

      let status = "PRESENT";
      let note: string | null = null;

      if (index === 3 && offset === 7) {
        status = "ABSENT";
        note = "غياب بدون إذن";
      } else if (index === 1 && offset === 9) {
        status = "SICK";
        note = "إجازة مرضية بعلم المدير";
      } else if (index === 2 && offset === 11) {
        status = "LEAVE";
        note = "الإجازة الشهرية";
      } else if (index === 4 && offset === 3) {
        status = "LEAVE";
        note = "ظرف عائلي";
      }

      await prisma.attendance.create({
        data: { employeeId: employee.id, date, status, workedFriday: false, note },
      });
    }
  }

  // 5) حوافز وخصومات للشهر الحالي
  const year = today.getFullYear();
  const month = today.getMonth() + 1;

  await prisma.incentive.create({
    data: {
      employeeId: employees[0].id,
      year,
      month,
      kind: "INCENTIVE",
      valueType: "AMOUNT",
      quantity: 0,
      amount: 750,
      note: "إنجاز أوردر مصنع الدلتا قبل الموعد",
    },
  });
  await prisma.incentive.create({
    data: {
      employeeId: employees[5].id,
      year,
      month,
      kind: "UNUSED_LEAVE",
      valueType: "AMOUNT",
      quantity: 0,
      amount: 216,
      note: "بدل يوم الإجازة الشهري غير المستخدم",
    },
  });
  await prisma.deduction.create({
    data: {
      employeeId: employees[3].id,
      year,
      month,
      valueType: "HOURS",
      quantity: 2,
      amount: Math.round((5500 / 30 / 10) * 2),
      note: "تأخير ساعتين",
    },
  });

  // 6) السلف
  const advance1Date = addDays(today, -12);
  const advance1 = await prisma.advance.create({
    data: {
      employeeId: employees[2].id,
      amount: 3000,
      date: advance1Date,
      fundingSource: "COMPANY_CASH",
      note: "ظرف شخصي",
    },
  });
  await prisma.cashTransaction.create({
    data: {
      date: advance1Date,
      type: "EXPENSE",
      amount: 3000,
      counterparty: `سلفة — ${employees[2].name}`,
      fundingSource: "COMPANY_CASH",
      origin: "ADVANCE",
      advanceId: advance1.id,
    },
  });

  await prisma.advance.create({
    data: {
      employeeId: employees[4].id,
      amount: 1500,
      date: addDays(today, -40) < systemStart ? systemStart : addDays(today, -40),
      fundingSource: "COMPANY_CASH",
      isOpeningBalance: true,
      note: "سلفة قائمة قبل تشغيل النظام",
    },
  });

  // 7) حركات الخزنة لآخر 20 يوم
  for (let offset = 20; offset >= 0; offset -= 1) {
    const date = addDays(today, -offset);
    if (date < systemStart) continue;

    const collectionsCount = offset % 3 === 0 ? 2 : 1;
    for (let index = 0; index < collectionsCount; index += 1) {
      await prisma.cashTransaction.create({
        data: {
          date,
          type: "COLLECTION",
          amount: 2500 + ((offset * 370 + index * 900) % 6500),
          counterparty:
            COLLECTION_SOURCES[(offset + index) % COLLECTION_SOURCES.length],
          fundingSource: "COMPANY_CASH",
          origin: "MANUAL",
        },
      });
    }

    if (offset % 2 === 0) {
      await prisma.cashTransaction.create({
        data: {
          date,
          type: "EXPENSE",
          amount: 400 + ((offset * 230) % 2200),
          counterparty: EXPENSE_ITEMS[offset % EXPENSE_ITEMS.length],
          fundingSource: offset === 6 ? "MANAGER_PERSONAL" : "COMPANY_CASH",
          origin: "MANUAL",
          note: offset === 6 ? "المدير دفع من ماله الخاص" : null,
        },
      });
    }

    if (offset === 4) {
      await prisma.cashTransaction.create({
        data: {
          date,
          type: "EXPENSE",
          amount: employees.reduce((sum, e) => sum + e.weeklyTransportAllowance, 0),
          counterparty: "بدل مواصلات الأسبوع",
          fundingSource: "COMPANY_CASH",
          origin: "TRANSPORT_ALLOWANCE",
        },
      });
    }
  }

  // 8) الإقفال اليومي بالترتيب (اليوم الحالي يفضل مفتوح للتجربة)
  const openingCash = 14000;
  let running = openingCash;
  for (let offset = 20; offset >= 1; offset -= 1) {
    const date = addDays(today, -offset);
    if (date < systemStart) continue;

    const dayTransactions = await prisma.cashTransaction.findMany({
      where: { date, deletedAt: null },
    });
    const collections = dayTransactions
      .filter((row) => row.type === "COLLECTION")
      .reduce((sum, row) => sum + row.amount, 0);
    const expenses = dayTransactions
      .filter(
        (row) => row.type === "EXPENSE" && row.fundingSource === "COMPANY_CASH",
      )
      .reduce((sum, row) => sum + row.amount, 0);

    const opening = running;
    const calculated = opening + collections - expenses;
    // فرق جرد في يوم واحد فقط لتوضيح شاشة العجز
    const actual = offset === 8 ? calculated - 500 : calculated;

    await prisma.dailyClosing.upsert({
      where: { date },
      update: {},
      create: {
        date,
        openingBalance: opening,
        collectionsTotal: collections,
        expensesTotal: expenses,
        calculatedClosing: calculated,
        actualCash: actual,
        difference: actual - calculated,
        differenceNote: offset === 8 ? "فرق جرد — تحت المراجعة" : null,
        status: "CLOSED",
        closedAt: date,
      },
    });

    running = calculated;
  }

  // 9) الرومان بلي
  await prisma.bearingMovement.createMany({
    data: [
      { date: systemStart, type: "OPENING", quantity: 100, note: "رصيد افتتاحي" },
      { date: addDays(today, -10), type: "IN", quantity: 20, note: "توريد جديد" },
      { date: addDays(today, -6), type: "OUT", quantity: 10, note: "صيانة موتور" },
    ],
  });

  // 10) عرض سعر
  const quotation = await prisma.quotation.create({
    data: {
      number: "2026/104",
      date: addDays(today, -2),
      customerName: "م. سامي عبد الرحمن",
      customerCompany: "مصنع الدلتا",
      customerPhone: "01111222333",
      mode: "ITEMS",
      total: 14500,
      validityNote: "العرض ساري لمدة 15 يومًا",
      terms: "التسليم خلال أسبوع من تاريخ الموافقة",
    },
  });
  await prisma.quotationItem.createMany({
    data: [
      {
        quotationId: quotation.id,
        description: "لف موتور 15 حصان نحاس",
        quantity: 1,
        unitPrice: 9000,
        lineTotal: 9000,
        sortOrder: 0,
      },
      {
        quotationId: quotation.id,
        description: "تغيير رومان بلي",
        quantity: 2,
        unitPrice: 1500,
        lineTotal: 3000,
        sortOrder: 1,
      },
      {
        quotationId: quotation.id,
        description: "مصنعية وضبط وتجربة",
        quantity: 1,
        unitPrice: 2500,
        lineTotal: 2500,
        sortOrder: 2,
      },
    ],
  });

  console.log("تم إنشاء البيانات التجريبية:");
  console.log(`  الموظفون       : ${employees.length}`);
  console.log(`  تاريخ البداية  : ${dateKey(systemStart)}`);
  console.log(`  رصيد افتتاحي   : ${openingCash} ج.م`);
  console.log("  الحضور والحركات المالية والإقفالات جاهزة للتجربة.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
