/**
 * إنشاء (أو تحديث) حساب صاحب المشروع المخفي — قرار BRD رقم 38.
 *
 * الحساب:
 *  - صلاحيات كاملة مثل المدير الإداري.
 *  - لا يظهر في شاشة حسابات الدخول في الإعدادات.
 *  - عملياته لا تُكتب في سجل التغييرات.
 *
 * التشغيل:
 *   npx tsx prisma/create-owner.ts "email@example.com" "كلمة المرور"
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const [emailArg, passwordArg, nameArg] = process.argv.slice(2);

  if (!emailArg || !passwordArg) {
    console.log(
      'الاستخدام: npx tsx prisma/create-owner.ts "email@example.com" "password" ["الاسم"]',
    );
    process.exit(1);
  }

  const email = emailArg.trim().toLowerCase();
  const name = (nameArg ?? "صاحب المشروع").trim();

  if (passwordArg.length < 8) {
    console.log("كلمة المرور لازم تكون 8 حروف على الأقل.");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(passwordArg, 10);
  const user = await prisma.user.upsert({
    where: { email },
    update: { name, passwordHash, role: "SUPER_ADMIN", isActive: true, hidden: true },
    create: {
      email,
      name,
      passwordHash,
      role: "SUPER_ADMIN",
      isActive: true,
      hidden: true,
    },
  });

  const visible = await prisma.user.count({ where: { hidden: false } });
  console.log("تم إنشاء/تحديث حساب صاحب المشروع المخفي:");
  console.log(`  البريد   : ${user.email}`);
  console.log(`  الاسم    : ${user.name}`);
  console.log(`  الصلاحية : كاملة (SUPER_ADMIN)`);
  console.log(`  مخفي     : نعم — لا يظهر في الإعدادات ولا في سجل التغييرات`);
  console.log(`\nالحسابات الظاهرة في شاشة الإعدادات: ${visible}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
