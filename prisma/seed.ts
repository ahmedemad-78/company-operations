/**
 * تهيئة أول تشغيل: إنشاء الحسابات الثلاثة (مدير إداري + مديرين) والإعدادات الأساسية.
 * التشغيل: npm run db:seed
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function upsertUser(
  email: string,
  password: string,
  name: string,
  role: string,
) {
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.upsert({
    where: { email },
    update: { name, role, isActive: true },
    create: { email, name, role, passwordHash },
  });
  return user;
}

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@company.local";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "Admin@12345";
  const managerPassword = process.env.SEED_MANAGER_PASSWORD ?? "Manager@12345";
  const manager1Email = process.env.SEED_MANAGER1_EMAIL ?? "manager1@company.local";
  const manager2Email = process.env.SEED_MANAGER2_EMAIL ?? "manager2@company.local";

  await upsertUser(adminEmail, adminPassword, "المدير الإداري", "SUPER_ADMIN");
  await upsertUser(manager1Email, managerPassword, "المدير الأول", "MANAGER");
  await upsertUser(manager2Email, managerPassword, "المدير الثاني", "MANAGER");

  const settings: Array<{ key: string; value: string }> = [
    { key: "COMPANY_NAME", value: "الشركة" },
    { key: "COMPANY_ADDRESS", value: "" },
    { key: "COMPANY_PHONE", value: "" },
    // تاريخ بداية بيانات النظام — قرار BRD رقم 22
    { key: "SYSTEM_START_DATE", value: "2026-01-01" },
    { key: "WORK_START", value: "09:00" },
    { key: "WORK_END", value: "19:00" },
  ];

  for (const setting of settings) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      update: {},
      create: setting,
    });
  }

  console.log("تمت التهيئة:");
  console.log(`  المدير الإداري : ${adminEmail} / ${adminPassword}`);
  console.log(`  المدير الأول   : ${manager1Email} / ${managerPassword}`);
  console.log(`  المدير الثاني  : ${manager2Email} / ${managerPassword}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
