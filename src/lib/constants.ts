/**
 * القيم الثابتة ومسمياتها العربية.
 * كل الحقول النصية في قاعدة البيانات تأخذ قيمها من هنا (لا توجد enums حتى يظل الـschema
 * متوافقًا مع SQLite محليًا و Postgres عند الـDeploy).
 */

export const ROLE = {
  SUPER_ADMIN: "SUPER_ADMIN",
  MANAGER: "MANAGER",
} as const;
export type Role = (typeof ROLE)[keyof typeof ROLE];

export const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "مدير إداري (صلاحيات كاملة)",
  MANAGER: "مدير (مشاهدة وتصدير)",
};

export const EMPLOYEE_STATUS = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
} as const;

export const EMPLOYEE_STATUS_LABEL: Record<string, string> = {
  ACTIVE: "يعمل",
  INACTIVE: "متوقف",
};

/**
 * العطلة الرسمية ليست حالة حضور — تُسجَّل مرة واحدة للشركة كلها في جدول CompanyHoliday
 * (قرار BRD رقم 30).
 */
export const ATTENDANCE_STATUS = {
  PRESENT: "PRESENT",
  ABSENT: "ABSENT",
  LEAVE: "LEAVE",
  SICK: "SICK",
} as const;

export const ATTENDANCE_STATUS_LABEL: Record<string, string> = {
  PRESENT: "حاضر",
  ABSENT: "غياب",
  LEAVE: "إجازة",
  SICK: "مرضي",
};

/** الحالات المدفوعة التي لا يُخصم عنها من المرتب */
export const PAID_ATTENDANCE_STATUSES: string[] = [
  ATTENDANCE_STATUS.PRESENT,
  ATTENDANCE_STATUS.LEAVE,
  ATTENDANCE_STATUS.SICK,
];

export const VALUE_TYPE = {
  AMOUNT: "AMOUNT",
  DAYS: "DAYS",
  HOURS: "HOURS",
} as const;

export const VALUE_TYPE_LABEL: Record<string, string> = {
  AMOUNT: "مبلغ",
  DAYS: "أيام",
  HOURS: "ساعات",
};

export const INCENTIVE_KIND = {
  INCENTIVE: "INCENTIVE",
  UNUSED_LEAVE: "UNUSED_LEAVE",
} as const;

export const INCENTIVE_KIND_LABEL: Record<string, string> = {
  INCENTIVE: "حافز",
  UNUSED_LEAVE: "بدل إجازة غير مستخدمة",
};

export const FUNDING_SOURCE = {
  COMPANY_CASH: "COMPANY_CASH",
  MANAGER_PERSONAL: "MANAGER_PERSONAL",
} as const;

export const FUNDING_SOURCE_LABEL: Record<string, string> = {
  COMPANY_CASH: "خزنة الشركة",
  MANAGER_PERSONAL: "المدير شخصيًا",
};

export const CASH_TYPE = {
  COLLECTION: "COLLECTION",
  EXPENSE: "EXPENSE",
} as const;

export const CASH_TYPE_LABEL: Record<string, string> = {
  COLLECTION: "تحصيل",
  EXPENSE: "مصروف",
};

export const CASH_ORIGIN = {
  MANUAL: "MANUAL",
  SALARY: "SALARY",
  ADVANCE: "ADVANCE",
  TRANSPORT_ALLOWANCE: "TRANSPORT_ALLOWANCE",
  BEARINGS_PURCHASE: "BEARINGS_PURCHASE",
} as const;

export const CASH_ORIGIN_LABEL: Record<string, string> = {
  MANUAL: "تسجيل يدوي",
  SALARY: "صرف مرتب",
  ADVANCE: "سلفة",
  TRANSPORT_ALLOWANCE: "بدل مواصلات",
  BEARINGS_PURCHASE: "شراء رومان بلي",
};

export const CLOSING_STATUS = {
  OPEN: "OPEN",
  CLOSED: "CLOSED",
} as const;

export const CLOSING_STATUS_LABEL: Record<string, string> = {
  OPEN: "مفتوح",
  CLOSED: "مقفول",
};

export const PAYROLL_STATUS = {
  OPEN: "OPEN",
  LOCKED: "LOCKED",
} as const;

export const PAYROLL_STATUS_LABEL: Record<string, string> = {
  OPEN: "مفتوح",
  LOCKED: "مقفول",
};

export const PAYMENT_STATUS = {
  UNPAID: "UNPAID",
  PAID: "PAID",
} as const;

export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  UNPAID: "لم يتم الصرف",
  PAID: "تم الصرف",
};

export const BEARING_MOVEMENT_TYPE = {
  OPENING: "OPENING",
  IN: "IN",
  OUT: "OUT",
} as const;

export const BEARING_MOVEMENT_TYPE_LABEL: Record<string, string> = {
  OPENING: "رصيد افتتاحي",
  IN: "وارد",
  OUT: "استخدام",
};

export const QUOTATION_MODE = {
  ITEMS: "ITEMS",
  LUMP: "LUMP",
} as const;

export const QUOTATION_MODE_LABEL: Record<string, string> = {
  ITEMS: "جدول بنود",
  LUMP: "مبلغ إجمالي",
};

export const AUDIT_ACTION = {
  CREATE: "CREATE",
  UPDATE: "UPDATE",
  DELETE: "DELETE",
  LOGIN: "LOGIN",
  LOGOUT: "LOGOUT",
  CLOSE_DAY: "CLOSE_DAY",
  REOPEN_DAY: "REOPEN_DAY",
  LOCK_PAYROLL: "LOCK_PAYROLL",
  UNLOCK_PAYROLL: "UNLOCK_PAYROLL",
  PAY_SALARY: "PAY_SALARY",
} as const;

export const AUDIT_ACTION_LABEL: Record<string, string> = {
  CREATE: "إضافة",
  UPDATE: "تعديل",
  DELETE: "إلغاء",
  LOGIN: "تسجيل دخول",
  LOGOUT: "تسجيل خروج",
  CLOSE_DAY: "إقفال يوم",
  REOPEN_DAY: "فتح يوم مقفول",
  LOCK_PAYROLL: "إقفال مرتبات شهر",
  UNLOCK_PAYROLL: "فتح مرتبات شهر",
  PAY_SALARY: "صرف مرتب",
};

export const ENTITY_LABEL: Record<string, string> = {
  Employee: "موظف",
  SalaryChange: "تغيير مرتب",
  ScheduleOverride: "تعديل مواعيد",
  Attendance: "حضور",
  CompanyHoliday: "عطلة رسمية",
  Incentive: "حافز",
  Deduction: "خصم",
  Advance: "سلفة",
  PayrollPeriod: "شهر مرتبات",
  PayrollLine: "مرتب موظف",
  CashTransaction: "حركة خزنة",
  DailyClosing: "إقفال يومي",
  BearingMovement: "حركة رومان بلي",
  Quotation: "عرض سعر",
  User: "مستخدم",
  Setting: "إعداد",
  Session: "جلسة",
};

/** ثوابت حساب المرتب — قرارات BRD أرقام 1 و 2 */
export const PAYROLL_DAYS_PER_MONTH = 30;
export const PAYROLL_HOURS_PER_DAY = 10;

/** مواعيد العمل الافتراضية */
export const DEFAULT_WORK_START = "09:00";
export const DEFAULT_WORK_END = "19:00";

export const SETTING_KEYS = {
  COMPANY_NAME: "COMPANY_NAME",
  COMPANY_ADDRESS: "COMPANY_ADDRESS",
  COMPANY_PHONE: "COMPANY_PHONE",
  SYSTEM_START_DATE: "SYSTEM_START_DATE",
  /** رصيد الخزنة الافتتاحي في تاريخ بداية النظام (قرار BRD رقم 22) */
  OPENING_CASH_BALANCE: "OPENING_CASH_BALANCE",
  WORK_START: "WORK_START",
  WORK_END: "WORK_END",
} as const;

export const SETTING_LABEL: Record<string, string> = {
  COMPANY_NAME: "اسم الشركة",
  COMPANY_ADDRESS: "عنوان الشركة",
  COMPANY_PHONE: "تليفونات الشركة",
  SYSTEM_START_DATE: "تاريخ بداية بيانات النظام",
  OPENING_CASH_BALANCE: "رصيد الخزنة الافتتاحي",
  WORK_START: "بداية يوم العمل",
  WORK_END: "نهاية يوم العمل",
};
