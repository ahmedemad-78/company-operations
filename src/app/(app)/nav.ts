/** قائمة الأقسام — ترتيبها هو ترتيب ظهورها في القائمة الجانبية */

export type NavItem = {
  href: string;
  label: string;
  /** القسم متاح للـSuper Admin فقط */
  superAdminOnly?: boolean;
  /** لسه قيد التنفيذ */
  soon?: boolean;
};

export const NAV_GROUPS: Array<{ title: string; items: NavItem[] }> = [
  {
    title: "الرئيسية",
    items: [{ href: "/", label: "لوحة التحكم" }],
  },
  {
    title: "الموظفون",
    items: [
      { href: "/employees", label: "الموظفون" },
      { href: "/attendance", label: "الحضور" },
      { href: "/adjustments", label: "الحوافز والخصومات" },
      { href: "/advances", label: "السلف" },
      { href: "/payroll", label: "المرتبات" },
    ],
  },
  {
    title: "الخزنة",
    items: [
      { href: "/cash", label: "التحصيلات والمصروفات" },
      { href: "/closing", label: "الإقفال اليومي" },
    ],
  },
  {
    title: "أخرى",
    items: [
      { href: "/bearings", label: "الرومان بلي" },
      { href: "/quotations", label: "عروض الأسعار" },
      { href: "/reports", label: "التقارير" },
    ],
  },
  {
    title: "الإدارة",
    items: [
      { href: "/audit", label: "سجل التغييرات", superAdminOnly: true },
      { href: "/settings", label: "الإعدادات", superAdminOnly: true },
    ],
  },
];
