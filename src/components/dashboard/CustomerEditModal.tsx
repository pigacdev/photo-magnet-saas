"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  normalizeLegacyShippingType,
  type StorefrontShippingType,
} from "@/lib/shippingTypes";
import {
  buildCustomerPatchBody,
  mapApiCustomerErrorToFields,
  validateCustomerEditForm,
  type CustomerFieldErrors,
  type CustomerFormValues,
} from "@/lib/validateOrderCustomerForm";

export type CustomerEditModalOrder = {
  orderId: string;
  contextType: "EVENT" | "STOREFRONT";
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  shippingType: string | null;
  shippingAddress: unknown | null;
};

export type CustomerEditModalProps = {
  open: boolean;
  order: CustomerEditModalOrder;
  onClose: () => void;
  onSaved: () => void;
};

function valuesFromOrder(order: CustomerEditModalOrder): CustomerFormValues {
  const addr = order.shippingAddress;
  let fullAddress = "";
  let addressNotes = "";
  let lockerId = "";
  if (addr && typeof addr === "object" && !Array.isArray(addr)) {
    const full = (addr as { fullAddress?: unknown }).fullAddress;
    if (typeof full === "string") fullAddress = full;
    const notes = (addr as { notes?: unknown }).notes;
    if (typeof notes === "string") addressNotes = notes;
    const locker = (addr as { lockerId?: unknown }).lockerId;
    if (typeof locker === "string") lockerId = locker;
  }
  return {
    customerName: order.customerName ?? "",
    customerEmail: order.customerEmail ?? "",
    customerPhone: order.customerPhone ?? "",
    shippingType: normalizeLegacyShippingType(order.shippingType),
    fullAddress,
    addressNotes,
    lockerId,
  };
}

function fieldInputClass(hasError: boolean): string {
  return `w-full rounded-lg border bg-white px-3 py-1.5 text-sm text-[#111111] outline-none focus:ring-2 ${
    hasError
      ? "border-red-300 ring-red-200 focus:ring-red-200"
      : "border-gray-200 ring-[#2563EB] focus:ring-[#2563EB]"
  }`;
}

function FieldHint({ error }: { error?: string }) {
  if (!error) return null;
  return <span className="text-xs leading-tight text-red-600">{error}</span>;
}

export function CustomerEditModal({
  open,
  order,
  onClose,
  onSaved,
}: CustomerEditModalProps) {
  const [values, setValues] = useState<CustomerFormValues>(() =>
    valuesFromOrder(order),
  );
  const [fieldErrors, setFieldErrors] = useState<CustomerFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isEvent = order.contextType === "EVENT";

  useEffect(() => {
    if (!open) return;
    setValues(valuesFromOrder(order));
    setFieldErrors({});
    setFormError(null);
  }, [open, order]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !saving) onClose();
    }

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, saving, onClose]);

  const patchField = useCallback(
    <K extends keyof CustomerFormValues>(key: K, value: CustomerFormValues[K]) => {
      setValues((prev) => ({ ...prev, [key]: value }));
      setFieldErrors((prev) => {
        if (!prev[key as keyof CustomerFieldErrors]) return prev;
        const next = { ...prev };
        delete next[key as keyof CustomerFieldErrors];
        return next;
      });
      setFormError(null);
    },
    [],
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errors = validateCustomerEditForm(order.contextType, values);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setFormError(null);
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      await api<{ ok: boolean }>(
        `/api/orders/${encodeURIComponent(order.orderId)}/customer`,
        {
          method: "PATCH",
          body: buildCustomerPatchBody(order.contextType, values),
        },
      );
      onSaved();
      onClose();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not save customer details";
      const mapped = mapApiCustomerErrorToFields(message);
      if (Object.keys(mapped).length > 0) {
        setFieldErrors(mapped);
        setFormError(null);
      } else {
        setFormError(message);
      }
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close dialog"
        onClick={() => {
          if (!saving) onClose();
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="customer-edit-title"
        className="relative w-full max-w-xl overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl"
      >
        <div className="border-b border-gray-100 px-4 py-3 sm:px-5">
          <h2
            id="customer-edit-title"
            className="text-base font-semibold text-[#111111] sm:text-lg"
          >
            Edit customer info
          </h2>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)}>
          <div className="space-y-2.5 px-4 py-3 sm:px-5">
            {formError && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm text-red-800">
                {formError}
              </p>
            )}

            <div className="grid gap-2.5 sm:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-[#111111]">
                  Full name <span className="text-red-600">*</span>
                </span>
                <input
                  type="text"
                  name="name"
                  autoComplete="name"
                  value={values.customerName}
                  onChange={(e) => patchField("customerName", e.target.value)}
                  className={fieldInputClass(Boolean(fieldErrors.customerName))}
                />
                <FieldHint error={fieldErrors.customerName} />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-[#111111]">
                  Phone
                  {!isEvent && <span className="text-red-600"> *</span>}
                </span>
                <input
                  type="tel"
                  name="phone"
                  autoComplete="tel"
                  value={values.customerPhone}
                  onChange={(e) => patchField("customerPhone", e.target.value)}
                  className={fieldInputClass(Boolean(fieldErrors.customerPhone))}
                />
                <FieldHint error={fieldErrors.customerPhone} />
              </label>
            </div>

            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-[#111111]">
                Email <span className="text-red-600">*</span>
              </span>
              <input
                type="email"
                name="email"
                autoComplete="email"
                value={values.customerEmail}
                onChange={(e) => patchField("customerEmail", e.target.value)}
                className={fieldInputClass(Boolean(fieldErrors.customerEmail))}
              />
              <FieldHint error={fieldErrors.customerEmail} />
            </label>

            {!isEvent && (
              <>
                <label className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-[#111111]">
                    Shipping method <span className="text-red-600">*</span>
                  </span>
                  <select
                    name="shippingType"
                    value={values.shippingType}
                    onChange={(e) =>
                      patchField(
                        "shippingType",
                        e.target.value as StorefrontShippingType,
                      )
                    }
                    className={fieldInputClass(false)}
                  >
                    <option value="pickup">Pickup</option>
                    <option value="delivery">Delivery</option>
                    <option value="boxnow">BoxNow</option>
                  </select>
                </label>

                {values.shippingType === "delivery" && (
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    <label className="flex flex-col gap-1 sm:col-span-2">
                      <span className="text-sm font-medium text-[#111111]">
                        Delivery address{" "}
                        <span className="text-red-600">*</span>
                      </span>
                      <textarea
                        name="fullAddress"
                        rows={2}
                        value={values.fullAddress}
                        onChange={(e) =>
                          patchField("fullAddress", e.target.value)
                        }
                        className={`${fieldInputClass(Boolean(fieldErrors.fullAddress))} resize-none`}
                      />
                      <FieldHint error={fieldErrors.fullAddress} />
                    </label>
                    <label className="flex flex-col gap-1 sm:col-span-2">
                      <span className="text-sm font-medium text-[#111111]">
                        Delivery notes
                      </span>
                      <input
                        type="text"
                        name="addressNotes"
                        value={values.addressNotes}
                        onChange={(e) =>
                          patchField("addressNotes", e.target.value)
                        }
                        placeholder="Apartment, gate code, instructions (optional)"
                        className={fieldInputClass(false)}
                      />
                    </label>
                  </div>
                )}

                {values.shippingType === "boxnow" && (
                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-[#111111]">
                      BoxNow locker id{" "}
                      <span className="text-red-600">*</span>
                    </span>
                    <input
                      type="text"
                      name="lockerId"
                      value={values.lockerId}
                      onChange={(e) => patchField("lockerId", e.target.value)}
                      className={fieldInputClass(Boolean(fieldErrors.lockerId))}
                    />
                    <FieldHint error={fieldErrors.lockerId} />
                  </label>
                )}
              </>
            )}
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-gray-100 px-4 py-3 sm:flex-row sm:justify-end sm:px-5">
            <button
              type="button"
              disabled={saving}
              onClick={onClose}
              className="min-h-10 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-[#111111] transition-colors hover:bg-[#F9FAFB] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="min-h-10 rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1d4ed8] disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
