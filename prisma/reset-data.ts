/**
 * تفريغ بيانات التشغيل قبل البدء بالبيانات الحقيقية.
 * التشغيل: npm run db:reset-data -- --yes
 *
 * يُبقي: حسابات الدخول (User) فقط.
 * يمسح: الموظفين والحضور والمرتبات والحوافز والخصومات والسلف وحركات الخزنة
 *        والإقفالات والعطلات والرومان بلي وعروض الأسعار وسجل التغييرات،
 *        ويعيد الإعدادات لقيمها الافتراضية.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  if (!process.argv.includes("--yes")) {
    console.log(
      "عملية حذف نهائية. أضف -- --yes للتأكيد:\n  npm run db:reset-data -- --yes",
    );
    return;
  }

  // الترتيب مهم بسبب العلاقات
  const deletions: Array<[string, () => Promise<{ count: number }>]> = [
    ["حركات الخزنة", () => prisma.cashTransaction.deleteMany()],
    ["الإقفالات اليومية", () => prisma.dailyClosing.deleteMany()],
    ["سطور المرتبات", () => prisma.payrollLine.deleteMany()],
    ["شهور المرتبات", () => prisma.payrollPeriod.deleteMany()],
    ["السلف", () => prisma.advance.deleteMany()],
    ["الحوافز", () => prisma.incentive.deleteMany()],
    ["الخصومات", () => prisma.deduction.deleteMany()],
    ["الحضور", () => prisma.attendance.deleteMany()],
    ["تعديلات المواعيد", () => prisma.scheduleOverride.deleteMany()],
    ["تغييرات المرتبات", () => prisma.salaryChange.deleteMany()],
    ["الموظفون", () => prisma.employee.deleteMany()],
    ["العطلات الرسمية", () => prisma.companyHoliday.deleteMany()],
    ["حركات الرومان بلي", () => prisma.bearingMovement.deleteMany()],
    ["بنود عروض الأسعار", () => prisma.quotationItem.deleteMany()],
    ["عروض الأسعار", () => prisma.quotation.deleteMany()],
    ["سجل التغييرات", () => prisma.auditLog.deleteMany()],
  ];

  for (const [label, run] of deletions) {
    const result = await run();
    console.log(`  حُذف ${result.count} — ${label}`);
  }

  const defaults: Array<[string, string]> = [
    ["COMPANY_NAME", "الشركة"],
    ["COMPANY_ADDRESS", ""],
    ["COMPANY_PHONE", ""],
    ["SYSTEM_START_DATE", "2026-01-01"],
    ["OPENING_CASH_BALANCE", "0"],
    ["WORK_START", "09:00"],
    ["WORK_END", "19:00"],
  ];
  for (const [key, value] of defaults) {
    await prisma.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }

  const users = await prisma.user.count();
  console.log(`\nتم التفريغ. حسابات الدخول المحفوظة: ${users}`);
  console.log(
    "الخطوة التالية: من شاشة الإعدادات اكتب بيانات الشركة وتاريخ البداية والرصيد الافتتاحي.",
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
