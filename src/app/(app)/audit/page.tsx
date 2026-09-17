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
  buttonSecondaryClass,
  inputClass,
} from "@/components/ui";
import {
  AUDIT_ACTION_LABEL,
  ENTITY_LABEL,
} from "@/lib/constants";
import { formatDateTime } from "@/lib/format";

const PAGE_SIZE = 100;

function actionTone(action: string) {
  if (action === "DELETE") return "danger" as const;
  if (action === "CREATE") return "success" as const;
  if (action === "UPDATE") return "info" as const;
  if (action.startsWith("REOPEN") || action.startsWith("UNLOCK")) {
    return "warning" as const;
  }
  return "neutral" as const;
}

function formatJson(value: string | null): string | null {
  if (!value) return null;
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; entity?: string }>;
}) {
  await requireSuperAdmin();
  const { action, entity } = await searchParams;

  const logs = await prisma.auditLog.findMany({
    where: {
      ...(action ? { action } : {}),
      ...(entity ? { entity } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: PAGE_SIZE,
  });

  return (
    <>
      <PageHeader
        title="سجل التغييرات (Audit Log)"
        description="كل الإضافات والتعديلات والإلغاءات وعمليات الدخول — متاح للمدير الإداري فقط"
      />

      <Card>
        <form className="mb-4 flex flex-wrap items-end gap-3">
          <div className="min-w-44">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">
              نوع العملية
            </span>
            <select name="action" defaultValue={action ?? ""} className={inputClass}>
              <option value="">الكل</option>
              {Object.entries(AUDIT_ACTION_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-44">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">
              القسم
            </span>
            <select name="entity" defaultValue={entity ?? ""} className={inputClass}>
              <option value="">الكل</option>
              {Object.entries(ENTITY_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className={buttonSecondaryClass}>
            تطبيق
          </button>
        </form>

        {logs.length === 0 ? (
          <EmptyState message="لا توجد عمليات مسجلة بعد." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>التاريخ والوقت</Th>
                <Th>المستخدم</Th>
                <Th>العملية</Th>
                <Th>القسم</Th>
                <Th>السجل</Th>
                <Th>التغيير</Th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
                const before = formatJson(log.beforeJson);
                const after = formatJson(log.afterJson);

                return (
                  <tr key={log.id} className="align-top">
                    <Td className="num whitespace-nowrap text-slate-500">
                      {formatDateTime(log.createdAt)}
                    </Td>
                    <Td>{log.userName}</Td>
                    <Td>
                      <Badge tone={actionTone(log.action)}>
                        {AUDIT_ACTION_LABEL[log.action] ?? log.action}
                      </Badge>
                    </Td>
                    <Td>{ENTITY_LABEL[log.entity] ?? log.entity}</Td>
                    <Td>{log.entityLabel || "—"}</Td>
                    <Td>
                      {before || after ? (
                        <details>
                          <summary className="cursor-pointer text-xs text-brand-600">
                            عرض التفاصيل
                          </summary>
                          <div className="mt-2 grid gap-2 text-xs">
                            {before ? (
                              <div>
                                <p className="mb-1 font-medium text-slate-500">
                                  قبل
                                </p>
                                <pre
                                  dir="ltr"
                                  className="max-h-48 overflow-auto rounded bg-slate-50 p-2 text-[11px] text-slate-600"
                                >
                                  {before}
                                </pre>
                              </div>
                            ) : null}
                            {after ? (
                              <div>
                                <p className="mb-1 font-medium text-slate-500">
                                  بعد
                                </p>
                                <pre
                                  dir="ltr"
                                  className="max-h-48 overflow-auto rounded bg-slate-50 p-2 text-[11px] text-slate-600"
                                >
                                  {after}
                                </pre>
                              </div>
                            ) : null}
                          </div>
                        </details>
                      ) : (
                        "—"
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
