"use client";

import { useActionState, useRef, useState } from "react";
import Link from "next/link";

import {
  Alert,
  Field,
  Table,
  Td,
  Th,
  buttonClass,
  buttonDangerClass,
  buttonSecondaryClass,
  inputClass,
} from "@/components/ui";
import { QUOTATION_MODE, QUOTATION_MODE_LABEL } from "@/lib/constants";
import { formatMoney } from "@/lib/format";
import type { ActionState } from "./actions";

export type QuotationItemValues = {
  description: string;
  quantity: number;
  unitPrice: number;
};

export type QuotationFormValues = {
  id?: string;
  number: string;
  date: string;
  customerName: string;
  customerCompany: string;
  customerPhone: string;
  mode: string;
  lumpDescription: string;
  lumpTotal: number;
  validityNote: string;
  terms: string;
  items: QuotationItemValues[];
};

/** الكمية والسعر تُحفظ كنص في الـstate حتى يقدر المستخدم يفرغ الخانة ويكتب من جديد */
type ItemRow = {
  key: string;
  description: string;
  quantity: string;
  unitPrice: string;
};

function toNumber(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function emptyRow(key: string): ItemRow {
  return { key, description: "", quantity: "1", unitPrice: "" };
}

export function QuotationForm({
  action,
  values,
  mode: formMode,
  customerNames,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  values: QuotationFormValues;
  mode: "create" | "edit";
  /** أسماء العملاء المستخدمة في عروض سابقة — تظهر كاقتراحات في datalist */
  customerNames: string[];
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [bodyMode, setBodyMode] = useState<string>(
    values.mode === QUOTATION_MODE.LUMP
      ? QUOTATION_MODE.LUMP
      : QUOTATION_MODE.ITEMS,
  );

  const [rows, setRows] = useState<ItemRow[]>(() =>
    values.items.length > 0
      ? values.items.map((item, index) => ({
          key: `row-${index}`,
          description: item.description,
          quantity: String(item.quantity),
          unitPrice: String(item.unitPrice),
        }))
      : [emptyRow("row-0")],
  );
  const nextKey = useRef(Math.max(rows.length, 1));

  function addRow() {
    setRows((current) => [...current, emptyRow(`row-${nextKey.current++}`)]);
  }

  function removeRow(key: string) {
    setRows((current) =>
      current.length <= 1
        ? current
        : current.filter((row) => row.key !== key),
    );
  }

  function patchRow(key: string, patch: Partial<ItemRow>) {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
  }

  const itemsTotal = rows.reduce(
    (sum, row) => sum + toNumber(row.quantity) * toNumber(row.unitPrice),
    0,
  );

  return (
    <form action={formAction} className="space-y-6">
      {state.error ? <Alert>{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}

      {values.id ? <input type="hidden" name="id" value={values.id} /> : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="رقم العرض" required hint="الرقم يُكتب يدويًا — لا يوجد ترقيم تلقائي">
          <input
            name="number"
            defaultValue={values.number}
            className={inputClass}
            required
          />
        </Field>

        <Field label="تاريخ العرض" required>
          <input
            name="date"
            type="date"
            defaultValue={values.date}
            className={inputClass}
            required
          />
        </Field>

        <Field
          label="اسم العميل"
          required
          hint="اكتب الاسم أو اختر من الأسماء المستخدمة في عروض سابقة"
        >
          <input
            name="customerName"
            list="quotation-customer-names"
            defaultValue={values.customerName}
            className={inputClass}
            autoComplete="off"
            required
          />
          <datalist id="quotation-customer-names">
            {customerNames.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </Field>

        <Field label="الشركة / الجهة">
          <input
            name="customerCompany"
            defaultValue={values.customerCompany}
            className={inputClass}
          />
        </Field>

        <Field label="تليفون العميل">
          <input
            name="customerPhone"
            defaultValue={values.customerPhone}
            className={inputClass}
          />
        </Field>
      </div>

      <fieldset className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <legend className="px-1 text-sm font-medium text-slate-700">
          شكل البنود
        </legend>
        <div className="flex flex-wrap gap-5">
          {[QUOTATION_MODE.ITEMS, QUOTATION_MODE.LUMP].map((option) => (
            <label key={option} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="mode"
                value={option}
                checked={bodyMode === option}
                onChange={() => setBodyMode(option)}
                className="size-4"
              />
              <span className="text-slate-700">
                {QUOTATION_MODE_LABEL[option]}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {bodyMode === QUOTATION_MODE.ITEMS ? (
        <div className="space-y-3">
          <Table>
            <thead>
              <tr>
                <Th className="w-1/2">وصف البند</Th>
                <Th className="w-24">الكمية</Th>
                <Th className="w-32">سعر الوحدة</Th>
                <Th className="w-32">الإجمالي</Th>
                <Th className="w-16" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key}>
                  <Td>
                    <input
                      name="itemDescription"
                      value={row.description}
                      onChange={(event) =>
                        patchRow(row.key, { description: event.target.value })
                      }
                      className={inputClass}
                    />
                  </Td>
                  <Td>
                    <input
                      name="itemQuantity"
                      type="number"
                      min={1}
                      step={1}
                      value={row.quantity}
                      onChange={(event) =>
                        patchRow(row.key, { quantity: event.target.value })
                      }
                      className={inputClass}
                    />
                  </Td>
                  <Td>
                    <input
                      name="itemUnitPrice"
                      type="number"
                      min={0}
                      step={1}
                      value={row.unitPrice}
                      onChange={(event) =>
                        patchRow(row.key, { unitPrice: event.target.value })
                      }
                      className={inputClass}
                    />
                  </Td>
                  <Td className="num font-medium text-slate-900">
                    {formatMoney(
                      toNumber(row.quantity) * toNumber(row.unitPrice),
                    )}
                  </Td>
                  <Td>
                    <button
                      type="button"
                      onClick={() => removeRow(row.key)}
                      className={buttonDangerClass}
                      disabled={rows.length <= 1}
                    >
                      حذف
                    </button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <button type="button" onClick={addRow} className={buttonSecondaryClass}>
              إضافة بند
            </button>
            <p className="text-sm text-slate-600">
              الإجمالي:{" "}
              <span className="num font-bold text-slate-900">
                {formatMoney(itemsTotal)}
              </span>{" "}
              ج.م
              <span className="mt-0.5 block text-xs text-slate-400">
                النظام يعيد حساب كل الإجماليات عند الحفظ
              </span>
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-5">
          <Field label="وصف الشغل" required>
            <textarea
              name="lumpDescription"
              rows={6}
              defaultValue={values.lumpDescription}
              className={inputClass}
            />
          </Field>
          <Field
            label="المبلغ الإجمالي"
            required
            hint="بالجنيه، بدون كسور — السعر نهائي بدون ضرائب"
          >
            <input
              name="lumpTotal"
              type="number"
              min={0}
              step={1}
              defaultValue={values.lumpTotal || ""}
              className={inputClass}
            />
          </Field>
        </div>
      )}

      <div className="grid gap-5">
        <Field label="صلاحية العرض" hint="مثال: العرض صالح لمدة 15 يومًا من تاريخه">
          <input
            name="validityNote"
            defaultValue={values.validityNote}
            className={inputClass}
          />
        </Field>

        <Field label="الشروط والملاحظات">
          <textarea
            name="terms"
            rows={4}
            defaultValue={values.terms}
            className={inputClass}
          />
        </Field>
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" className={buttonClass} disabled={pending}>
          {pending
            ? "جاري الحفظ..."
            : formMode === "create"
              ? "حفظ عرض السعر"
              : "حفظ التعديلات"}
        </button>
        <Link
          href={values.id ? `/quotations/${values.id}` : "/quotations"}
          className={buttonSecondaryClass}
        >
          إلغاء
        </Link>
      </div>
    </form>
  );
}
