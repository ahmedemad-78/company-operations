import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth";
import {
  Badge,
  Card,
  EmptyState,
  PageHeader,
  Table,
  Td,
  Th,
  buttonDangerClass,
  buttonSecondaryClass,
} from "@/components/ui";
import { ROLE, ROLE_LABEL } from "@/lib/constants";
import { formatDateWithWeekday } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { HolidayForm, SettingsForm } from "./settings-forms";
import { CreateManagerForm, ResetPasswordForm } from "./user-forms";
import { addHoliday, deleteHoliday, updateSettings } from "./actions";
import { createManager, resetPassword, toggleUserActive } from "./user-actions";

export default async function SettingsPage() {
  const currentUser = await requireSuperAdmin();

  const [settings, holidays, users] = await Promise.all([
    getSettings(),
    prisma.companyHoliday.findMany({
      where: { deletedAt: null },
      orderBy: { date: "desc" },
    }),
    // حساب صاحب المشروع المخفي لا يظهر في القائمة (قرار BRD رقم 38)
    prisma.user.findMany({
      where: { hidden: false },
      orderBy: [{ role: "asc" }, { name: "asc" }],
    }),
  ]);

  return (
    <>
      <PageHeader
        title="الإعدادات"
        description="بيانات الشركة وبداية التشغيل والعطلات الرسمية — متاحة للمدير الإداري فقط"
      />

      <div className="space-y-6">
        <Card title="بيانات الشركة وبداية التشغيل">
          <SettingsForm action={updateSettings} values={settings} />
        </Card>

        <Card
          title="العطلات الرسمية"
          description="تُسجَّل مرة واحدة للشركة كلها: اليوم مدفوع، لا يُطلب فيه تسجيل حضور، ولا يستهلك الإجازة الشهرية"
        >
          <HolidayForm action={addHoliday} />

          <div className="mt-5">
            {holidays.length === 0 ? (
              <EmptyState message="لا توجد عطلات رسمية مسجلة بعد." />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>التاريخ</Th>
                    <Th>العطلة</Th>
                    <Th className="w-24" />
                  </tr>
                </thead>
                <tbody>
                  {holidays.map((holiday) => (
                    <tr key={holiday.id}>
                      <Td className="num whitespace-nowrap">
                        {formatDateWithWeekday(holiday.date)}
                      </Td>
                      <Td>{holiday.name}</Td>
                      <Td>
                        <form action={deleteHoliday}>
                          <input type="hidden" name="id" value={holiday.id} />
                          <button type="submit" className={buttonDangerClass}>
                            إلغاء
                          </button>
                        </form>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </div>
        </Card>

        <Card
          title="حسابات الدخول"
          description="المدير الإداري هو من ينشئ حسابات المديرين ويعيد تعيين كلمات المرور"
        >
          <CreateManagerForm action={createManager} />

          <div className="mt-6">
            <Table>
              <thead>
                <tr>
                  <Th>الاسم</Th>
                  <Th>البريد الإلكتروني</Th>
                  <Th className="w-40">الصلاحية</Th>
                  <Th className="w-64">كلمة المرور</Th>
                  <Th className="w-28">الحالة</Th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <Td>{user.name}</Td>
                    <Td className="text-xs text-slate-500">
                      <span dir="ltr">{user.email}</span>
                    </Td>
                    <Td>
                      <Badge
                        tone={user.role === ROLE.SUPER_ADMIN ? "info" : "neutral"}
                      >
                        {ROLE_LABEL[user.role] ?? user.role}
                      </Badge>
                    </Td>
                    <Td>
                      <ResetPasswordForm action={resetPassword} userId={user.id} />
                    </Td>
                    <Td>
                      {user.role === ROLE.SUPER_ADMIN || user.id === currentUser.id ? (
                        <Badge tone="success">نشط</Badge>
                      ) : (
                        <form action={toggleUserActive}>
                          <input type="hidden" name="id" value={user.id} />
                          <button
                            type="submit"
                            className={
                              user.isActive ? buttonDangerClass : buttonSecondaryClass
                            }
                          >
                            {user.isActive ? "إيقاف" : "تفعيل"}
                          </button>
                        </form>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </Card>
      </div>
    </>
  );
}
