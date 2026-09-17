import type { Metadata } from "next";
import { Aref_Ruqaa, Cairo } from "next/font/google";
import "./globals.css";

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic", "latin"],
  display: "swap",
});

const brandFont = Aref_Ruqaa({
  variable: "--font-brand",
  weight: "700",
  subsets: ["arabic", "latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "الأمير موتورز | إدارة الشركة",
  description: "نظام الأمير موتورز لإدارة الموظفين والحضور والمرتبات والخزنة والتقارير",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl" className={`${cairo.variable} ${brandFont.variable} h-full`}>
      <body className="min-h-full antialiased">{children}</body>
    </html>
  );
}
