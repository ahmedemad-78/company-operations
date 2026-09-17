import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { getCurrentUser, isSuperAdmin, requireUser } from "@/lib/auth";
import {
  Alert,
  Badge,
  Card,
  EmptyState,
  PageHeader,
  Table,
  Td,
  Th,
  buttonDangerClass,
  buttonSecondaryClass,
  inputClass,
} from "@/components/ui";
import {
  ATTENDANCE_STATUS,
  ATTENDANCE_STATUS_LABEL,
  DEFAULT_WORK_END,
  DEFAULT_WORK_START,
  EMPLOYEE_STATUS,
} from "@/lib/constants";
import {
  addDays,
  formatDate,
  formatDateWithWeekday,
  formatMonthYear,
  isFriday,
  startOfDay,
  toDateInputValue,
} from "@/lib/format";
import {
  dateKey,
  monthEnd,
  monthStart,
  requiredAttendanceDates,
} from "@/lib/period";
import { summarizeAttendance } from "@/lib/payroll-engine";
import { AttendanceForm, ScheduleOverrideForm } from "./attendance-form";
import {
  deleteScheduleOverride,
  saveAttendance,
  saveScheduleOverride,
} from "./actions";

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  await requireUser();
  const user = await getCurrentUser();
  const canEdit = isSuperAdmin(user);

  const { date: dateParam } = await searchParams;
  const day = startOfDay(dateParam || new Date());
  const dayValue = toDateInputValue(day);
  const year = day.getFullYear();
  const month = day.getMonth() + 1;
  const isFutureDay = day.getTime() > startOfDay(new Date()).getTime();

  const [employees, dayRecords, holidays, overrides, monthRecords] =
    await Promise.all([
      prisma.employee.findMany({
        where: {
          deletedAt: null,
          status: EMPLOYEE_STATUS.ACTIVE,
          startDate: { lte: day },
          OR: [{ endDate: null }, { endDate: { gte: day } }],
        },
        orderBy: { name: "asc" },
      }),
      prisma.attendance.findMany({
        where: { date: day, deletedAt: null },
      }),
      prisma.companyHoliday.findMany({
        where: {
          deletedAt: null,
          date: { gte: monthStart(year, month), lte: monthEnd(year, month) },
        },
      }),
      prisma.scheduleOverride.findMany({
        where: { date: day, deletedAt: null },
        include: { employee: { select: { name: true } } },
      }),
      prisma.attendance.findMany({
        where: {
          deletedAt: null,
          date: { gte: monthStart(year, month), lte: monthEnd(year, month) },
        },
      }),
    ]);

  const holidayKeys = new Set(holidays.map((holiday) => dateKey(holiday.date)));
  const todayHoliday = holidays.find(
    (holiday) => dateKey(holiday.date) === dateKey(day),
  );
  const friday = isFriday(day);

  const recordsByEmployee = new Map(dayRecords.map((row) => [row.employeeId, row]));
  const overrideByEmployee = new Map(
    overrides.map((row) => [row.employeeId, row]),
  );

  const rows = employees.map((employee) => {
    const record = recordsByEmployee.get(employee.id);
    const override = overrideByEmployee.get(employee.id);
    const scheduleLabel = override
      ? `${override.startTime} → ${override.endTime} (معدّل)`
      : employee.hasFixedSchedule
        ? `${DEFAULT_WORK_START} → ${DEFAULT_WORK_END}`
        : "مواعيد غير ثابتة";

    return {
      employeeId: employee.id,
      name: employee.name,
      jobTitle: employee.jobTitle,
      status: record?.status ?? ATTENDANCE_STATUS.PRESENT,
      note: record?.note ?? "",
      workedFriday: record?.workedFriday ?? false,
      scheduleLabel,
    };
  });

  // ملخص الشهر لكل موظف — نفس الحساب الذي تستخدمه شاشة المرتبات
  const monthEmployees = await prisma.employee.findMany({
    where: {
      deletedAt: null,
      startDate: { lte: monthEnd(year, month) },
      OR: [{ endDate: null }, { endDate: { gte: monthStart(year, month) } }],
    },
    orderBy: { name: "asc" },
  });

  const monthSummaries = monthEmployees.map((employee) => {
    const required = requiredAttendanceDates(employee, year, month, holidayKeys);
    const records = monthRecords
      .filter((row) => row.employeeId === employee.id)
      .map((row) => ({
        date: row.date,
        status: row.status,
        workedFriday: row.workedFriday,
      }));

    const summary = summarizeAttendance({
      records,
      requiredDates: required,
      monthlyPaidLeaveDays: employee.monthlyPaidLeaveDays,
      holidayDaysInRange: holidays.length,
    });

    return { employee, summary, requiredDays: required.length };
  });

  return (
    <>
      <PageHeader
        title="الحضور"
        description="تسجيل يومي — الجمعة والعطلات الرسمية لا يُسجَّل فيها حضور، وأي يوم مطلوب ولم يُسجَّل يُحتسب غيابًا"
        actions={
          canEdit ? (
            <Link href="/settings" className={buttonSecondaryClass}>
              إدارة العطلات الرسمية
            </Link>
          ) : undefined
        }
      />

      <Card className="mb-6">
        <form className="flex flex-wrap items-end gap-3">
          <div className="min-w-48">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">
              اليوم
            </span>
            <input
              name="date"
              type="date"
              defaultValue={dayValue}
              className={inputClass}
            />
          </div>
          <button type="submit" className={buttonSecondaryClass}>
            عرض
          </button>
          <Link
            href={`/attendance?date=${toDateInputValue(addDays(day, -1))}`}
            className={buttonSecondaryClass}
          >
            اليوم السابق
          </Link>
          <Link
            href={`/attendance?date=${toDateInputValue(addDays(day, 1))}`}
            className={buttonSecondaryClass}
          >
            اليوم التالي
          </Link>
          <p className="ms-auto flex items-center gap-2 text-sm text-slate-500">
            {formatDateWithWeekday(day)}
            {friday ? <Badge tone="info">عطلة أسبوعية</Badge> : null}
            {todayHoliday ? <Badge tone="warning">{todayHoliday.name}</Badge> : null}
          </p>
        </form>
      </Card>

      <Card title="حضور اليوم" className="mb-6">
        {todayHoliday ? (
          <Alert tone="info">
            {todayHoliday.name} — عطلة رسمية مدفوعة للشركة كلها، لا يُطلب تسجيل حضور،
            ولا تستهلك يوم الإجازة الشهري.
          </Alert>
        ) : isFutureDay ? (
          <Alert tone="info">لا يمكن تسجيل حضور ليوم في المستقبل.</Alert>
        ) : employees.length === 0 ? (
          <EmptyState message="لا يوجد موظفون على رأس العمل في هذا اليوم." />
        ) : !canEdit ? (
          <Table>
            <thead>
              <tr>
                <Th>الموظف</Th>
                <Th className="w-40">الحالة</Th>
                <Th>ملاحظة</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const record = recordsByEmployee.get(row.employeeId);
                return (
                  <tr key={row.employeeId}>
                    <Td>
                      <span className="font-medium text-slate-800">{row.name}</span>
                      <span className="mt-0.5 block text-xs text-slate-400">
                        {row.jobTitle}
                      </span>
                    </Td>
                    <Td>
                      {friday ? (
                        record?.workedFriday ? (
                          <Badge tone="success">عمل يوم الجمعة</Badge>
                        ) : (
                          <Badge tone="neutral">عطلة</Badge>
                        )
                      ) : record ? (
                        <Badge
                          tone={
                            record.status === ATTENDANCE_STATUS.PRESENT
                              ? "success"
                              : record.status === ATTENDANCE_STATUS.ABSENT
                                ? "danger"
                                : "info"
                          }
                        >
                          {ATTENDANCE_STATUS_LABEL[record.status] ?? record.status}
                        </Badge>
                      ) : (
                        <Badge tone="danger">غير مسجل — يُحتسب غيابًا</Badge>
                      )}
                    </Td>
                    <Td className="text-xs text-slate-500">{record?.note || "—"}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        ) : (
          <AttendanceForm
            action={saveAttendance}
            date={dayValue}
            rows={rows}
            isFriday={friday}
          />
        )}
      </Card>

      {canEdit && !todayHoliday && employees.length > 0 ? (
        <Card
          title="تعديل مواعيد موظف في هذا اليوم"
          description="Override ليوم واحد فقط بدون تغيير المواعيد الافتراضية"
          className="mb-6"
        >
          <ScheduleOverrideForm
            action={saveScheduleOverride}
            date={dayValue}
            employees={employees.map((employee) => ({
              id: employee.id,
              name: employee.name,
            }))}
          />

          {overrides.length > 0 ? (
            <div className="mt-5">
              <Table>
                <thead>
                  <tr>
                    <Th>الموظف</Th>
                    <Th className="w-40">المواعيد</Th>
                    <Th>ملاحظة</Th>
                    <Th className="w-24" />
                  </tr>
                </thead>
                <tbody>
                  {overrides.map((override) => (
                    <tr key={override.id}>
                      <Td>{override.employee.name}</Td>
                      <Td className="num">
                        {override.startTime} → {override.endTime}
                      </Td>
                      <Td className="text-xs text-slate-500">
                        {override.note || "—"}
                      </Td>
                      <Td>
                        <form action={deleteScheduleOverride}>
                          <input type="hidden" name="id" value={override.id} />
                          <button type="submit" className={buttonDangerClass}>
                            إلغاء
                          </button>
                        </form>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          ) : null}
        </Card>
      ) : null}

      <Card
        title={`ملخص ${formatMonthYear(year, month)}`}
        description="نفس الأرقام التي تدخل في حساب المرتب"
      >
        {monthSummaries.length === 0 ? (
          <EmptyState message="لا يوجد موظفون في هذا الشهر." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>الموظف</Th>
                <Th className="w-24">أيام مطلوبة</Th>
                <Th className="w-20">حاضر</Th>
                <Th className="w-20">غياب</Th>
                <Th className="w-20">إجازة</Th>
                <Th className="w-24">إجازة زائدة</Th>
                <Th className="w-20">مرضي</Th>
                <Th className="w-24">جمعة عمل</Th>
                <Th className="w-24">غير مسجل</Th>
              </tr>
            </thead>
            <tbody>
              {monthSummaries.map(({ employee, summary, requiredDays }) => (
                <tr key={employee.id}>
                  <Td>
                    <Link
                      href={`/employees/${employee.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      {employee.name}
                    </Link>
                  </Td>
                  <Td className="num">{requiredDays}</Td>
                  <Td className="num text-emerald-700">{summary.presentDays}</Td>
                  <Td className="num text-rose-700">{summary.absentDays}</Td>
                  <Td className="num">{summary.leaveDays}</Td>
                  <Td className="num text-amber-700">{summary.excessLeaveDays}</Td>
                  <Td className="num">{summary.sickDays}</Td>
                  <Td className="num text-blue-700">{summary.workedFridays}</Td>
                  <Td className="num text-slate-400">{summary.unrecordedDays}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        <p className="mt-3 text-xs text-slate-400">
          آخر يوم في الحساب هو اليوم الحالي — الأيام القادمة في الشهر لا تُحتسب غيابًا.
          آخر تحديث للعطلات: {holidays.length} عطلة رسمية في {formatDate(monthStart(year, month))}
          {" — "}
          {formatDate(monthEnd(year, month))}.
        </p>
      </Card>
    </>
  );
}
