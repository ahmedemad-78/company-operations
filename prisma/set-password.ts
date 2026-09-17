/**
 * تغيير كلمة مرور حساب موجود بدون تغيير صلاحيته أو حالة إخفائه.
 *
 * التشغيل:
 *   npx tsx prisma/set-password.ts "email@example.com" "كلمة المرور الجديدة"
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const [emailArg, passwordArg] = process.argv.slice(2);

  if (!emailArg || !passwordArg) {
    console.log(
      'الاستخدام: npx tsx prisma/set-password.ts "email@example.com" "password"',
    );
    process.exit(1);
  }

  const email = emailArg.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.log(`مفيش حساب بالبريد ${email} في هذه المساحة.`);
    process.exit(1);
  }

  await prisma.user.update({
    where: { email },
    data: { passwordHash: await bcrypt.hash(passwordArg, 10) },
  });

  console.log("تم تغيير كلمة المرور:");
  console.log(`  البريد   : ${user.email}`);
  console.log(`  الاسم    : ${user.name}`);
  console.log(`  الصلاحية : ${user.role}`);
  console.log(`  مخفي     : ${user.hidden ? "نعم" : "لا"}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
