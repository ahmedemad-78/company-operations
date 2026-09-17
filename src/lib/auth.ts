import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";

import { prisma } from "@/lib/prisma";
import { ROLE } from "@/lib/constants";

const SESSION_COOKIE = "coms_session";
const SESSION_DAYS = 7;

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("AUTH_SECRET غير مضبوط في ملف .env");
  }
  return new TextEncoder().encode(secret);
}

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  /** حساب صاحب المشروع المخفي — لا يظهر في شاشة الحسابات ولا يُسجَّل في سجل التغييرات */
  hidden: boolean;
};

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: string): Promise<void> {
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expires)
    .sign(secretKey());

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** يقرأ الجلسة ويتحقق من المستخدم في قاعدة البيانات. null لو مفيش جلسة صالحة. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secretKey());
    const userId = typeof payload.sub === "string" ? payload.sub : null;
    if (!userId) return null;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        hidden: true,
      },
    });
    if (!user || !user.isActive) return null;

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      hidden: user.hidden,
    };
  } catch {
    return null;
  }
});

/** أي صفحة داخل النظام تستدعيها — تُحوِّل لصفحة الدخول لو مفيش جلسة. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** الصفحات والعمليات المتاحة للـSuper Admin فقط. */
export async function requireSuperAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== ROLE.SUPER_ADMIN) redirect("/no-access");
  return user;
}

export function isSuperAdmin(user: SessionUser | null): boolean {
  return user?.role === ROLE.SUPER_ADMIN;
}

/**
 * تُستخدم داخل Server Actions: ترمي خطأ بدل التحويل، عشان نعرض رسالة للمستخدم.
 * المديرون View Only فيما عدا حركات الرومان بلي (قرار BRD رقم 20).
 */
export async function assertSuperAdmin(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("انتهت الجلسة، من فضلك سجل الدخول مرة أخرى.");
  if (user.role !== ROLE.SUPER_ADMIN) {
    throw new Error("غير مسموح: هذه العملية متاحة للمدير الإداري فقط.");
  }
  return user;
}

/** عمليات مسموحة للجميع (Super Admin + Managers) مثل حركات الرومان بلي. */
export async function assertAnyUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("انتهت الجلسة، من فضلك سجل الدخول مرة أخرى.");
  return user;
}
