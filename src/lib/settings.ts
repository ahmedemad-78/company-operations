import "server-only";

import { prisma } from "@/lib/prisma";
import { SETTING_KEYS } from "@/lib/constants";
import { startOfDay } from "@/lib/format";

export const SETTING_DEFAULTS: Record<string, string> = {
  [SETTING_KEYS.COMPANY_NAME]: "الشركة",
  [SETTING_KEYS.COMPANY_ADDRESS]: "",
  [SETTING_KEYS.COMPANY_PHONE]: "",
  [SETTING_KEYS.SYSTEM_START_DATE]: "2026-01-01",
  [SETTING_KEYS.OPENING_CASH_BALANCE]: "0",
  [SETTING_KEYS.WORK_START]: "09:00",
  [SETTING_KEYS.WORK_END]: "19:00",
};

export async function getSettings(): Promise<Record<string, string>> {
  const rows = await prisma.setting.findMany();
  const values: Record<string, string> = { ...SETTING_DEFAULTS };
  for (const row of rows) {
    values[row.key] = row.value;
  }
  return values;
}

export async function getSetting(key: string): Promise<string> {
  const row = await prisma.setting.findUnique({ where: { key } });
  return row?.value ?? SETTING_DEFAULTS[key] ?? "";
}

export async function saveSettings(entries: Record<string, string>): Promise<void> {
  for (const [key, value] of Object.entries(entries)) {
    await prisma.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }
}

/** تاريخ بداية بيانات النظام — لا يُسمح بتسجيل أي حركة قبله */
export async function getSystemStartDate(): Promise<Date> {
  const value = await getSetting(SETTING_KEYS.SYSTEM_START_DATE);
  const parsed = startOfDay(value || SETTING_DEFAULTS[SETTING_KEYS.SYSTEM_START_DATE]);
  return Number.isNaN(parsed.getTime())
    ? startOfDay(SETTING_DEFAULTS[SETTING_KEYS.SYSTEM_START_DATE])
    : parsed;
}

export async function getOpeningCashBalance(): Promise<number> {
  const value = await getSetting(SETTING_KEYS.OPENING_CASH_BALANCE);
  const parsed = Number.parseInt(value || "0", 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function getCompanyInfo(): Promise<{
  name: string;
  address: string;
  phone: string;
}> {
  const settings = await getSettings();
  return {
    name: settings[SETTING_KEYS.COMPANY_NAME] || "الشركة",
    address: settings[SETTING_KEYS.COMPANY_ADDRESS] || "",
    phone: settings[SETTING_KEYS.COMPANY_PHONE] || "",
  };
}
