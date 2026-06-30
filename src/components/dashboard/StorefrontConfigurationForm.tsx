"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { getEventConfigurationIssues } from "@/lib/eventConfiguration";
import { useUnsavedChangesWarning } from "@/hooks/useUnsavedChangesWarning";
import {
  getShapePresets,
  SHAPE_PRESET_VALUES,
  shapePresetKey,
  shapeRecordKey,
} from "@/lib/shapePresets";
import {
  PricingEditor,
  PricingPreview,
  savePricingConfiguration,
  type PricingEditorHandle,
  type PricingRule,
} from "@/components/PricingEditor";
import Link from "next/link";
import { useOrganizationUsage } from "@/hooks/useOrganizationUsage";
import { FREE_PRINT_BRAND_TEXT } from "@/lib/planCatalog";
import { usageHasFeature } from "@/lib/planFeatures";
import {
  buildStructuredShippingAddress,
  optionalStructuredAddressPayload,
  parseShippingAddressFromJson,
  validateOptionalStructuredAddress,
  type StructuredShippingAddress,
} from "@/lib/shippingAddress";

type AllowedShape = {
  id: string;
  shapeType: string;
  widthMm: number;
  heightMm: number;
  displayOrder: number;
};

export type StorefrontConfigurationStorefront = {
  id: string;
  name: string;
  brandText: string | null;
  notificationEmail: string | null;
  sendOrderEmails: boolean;
  isActive: boolean;
  isOpen: boolean;
  configurationComplete?: boolean;
  maxMagnetsPerOrder: number | null;
  pickupAddress: StructuredShippingAddress | null;
  shapes: AllowedShape[];
  pricing: PricingRule[];
};

type StorefrontConfigurationFormProps = {
  storefront: StorefrontConfigurationStorefront;
  onSaved: (storefront: StorefrontConfigurationStorefront) => void;
  onDirtyChange?: (dirty: boolean) => void;
};

function shapeKeySetsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const key of a) {
    if (!b.has(key)) return false;
  }
  return true;
}

function pickupFieldsFromStorefront(
  raw: unknown,
): StructuredShippingAddress {
  const parsed = parseShippingAddressFromJson(raw);
  return parsed.kind === "structured"
    ? parsed.structured
    : {
        street: "",
        houseNumber: "",
        city: "",
        postCode: "",
        country: "",
      };
}

function pickupFieldsEqual(
  a: StructuredShippingAddress,
  b: StructuredShippingAddress,
): boolean {
  return (
    a.street === b.street &&
    a.houseNumber === b.houseNumber &&
    a.city === b.city &&
    a.postCode === b.postCode &&
    a.country === b.country
  );
}

async function syncStorefrontShapes(
  storefrontId: string,
  currentShapes: AllowedShape[],
  selectedKeys: Set<string>,
) {
  const currentByKey = new Map(
    currentShapes.map((s) => [shapeRecordKey(s), s]),
  );

  const toRemove = currentShapes.filter(
    (s) => !selectedKeys.has(shapeRecordKey(s)),
  );
  const toAdd = SHAPE_PRESET_VALUES.filter(
    (value) =>
      selectedKeys.has(shapePresetKey(value)) &&
      !currentByKey.has(shapePresetKey(value)),
  );

  for (const shape of toRemove) {
    await api(`/api/storefronts/${storefrontId}/shapes/${shape.id}`, {
      method: "DELETE",
    });
  }

  for (const value of toAdd) {
    await api(`/api/storefronts/${storefrontId}/shapes`, {
      method: "POST",
      body: value,
    });
  }
}

export function StorefrontConfigurationForm({
  storefront,
  onSaved,
  onDirtyChange,
}: StorefrontConfigurationFormProps) {
  const pricingRef = useRef<PricingEditorHandle>(null);
  const usage = useOrganizationUsage();
  const orgCurrency = usage?.currency ?? "EUR";
  const shapePresets = useMemo(
    () => getShapePresets(usage?.sizeUnit ?? "mm"),
    [usage?.sizeUnit],
  );
  const canCustomBrand = usageHasFeature(usage, "custom_branding");
  const canEmailNotif = usageHasFeature(usage, "email_notifications");

  const [brandDraft, setBrandDraft] = useState(storefront.brandText ?? "");
  const [notifEmailDraft, setNotifEmailDraft] = useState(
    storefront.notificationEmail ?? "",
  );
  const [notifSendDraft, setNotifSendDraft] = useState(
    storefront.sendOrderEmails ?? false,
  );
  const savedPickupFields = useMemo(
    () => pickupFieldsFromStorefront(storefront.pickupAddress),
    [storefront.pickupAddress],
  );
  const [pickupStreet, setPickupStreet] = useState(savedPickupFields.street);
  const [pickupHouseNumber, setPickupHouseNumber] = useState(
    savedPickupFields.houseNumber,
  );
  const [pickupCity, setPickupCity] = useState(savedPickupFields.city);
  const [pickupPostCode, setPickupPostCode] = useState(savedPickupFields.postCode);
  const [pickupCountry, setPickupCountry] = useState(savedPickupFields.country);
  const pickupDraft = useMemo(
    () =>
      buildStructuredShippingAddress({
        street: pickupStreet,
        houseNumber: pickupHouseNumber,
        city: pickupCity,
        postCode: pickupPostCode,
        country: pickupCountry,
      }),
    [pickupStreet, pickupHouseNumber, pickupCity, pickupPostCode, pickupCountry],
  );
  const pickupFieldsEmpty =
    !pickupDraft.street &&
    !pickupDraft.houseNumber &&
    !pickupDraft.city &&
    !pickupDraft.postCode &&
    !pickupDraft.country;
  const [selectedShapeKeys, setSelectedShapeKeys] = useState<Set<string>>(
    () => new Set(storefront.shapes.map((s) => shapeRecordKey(s))),
  );
  const [pricingDirty, setPricingDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [savedMessage, setSavedMessage] = useState("");

  const savedShapeKeys = useMemo(
    () => new Set(storefront.shapes.map((s) => shapeRecordKey(s))),
    [storefront.shapes],
  );

  const isDirty = useMemo(() => {
    const shapesDirty = !shapeKeySetsEqual(savedShapeKeys, selectedShapeKeys);
    const brandDirty = (storefront.brandText ?? "") !== brandDraft.trim();
    const emailDirty =
      (storefront.notificationEmail ?? "") !== notifEmailDraft.trim();
    const sendDirty =
      (storefront.sendOrderEmails ?? false) !== notifSendDraft;
    const pickupDirty = !pickupFieldsEqual(savedPickupFields, pickupDraft);
    return (
      shapesDirty ||
      brandDirty ||
      emailDirty ||
      sendDirty ||
      pickupDirty ||
      pricingDirty
    );
  }, [
    pricingDirty,
    savedShapeKeys,
    selectedShapeKeys,
    storefront.brandText,
    storefront.notificationEmail,
    storefront.sendOrderEmails,
    savedPickupFields,
    pickupDraft,
    brandDraft,
    notifEmailDraft,
    notifSendDraft,
  ]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  useUnsavedChangesWarning(isDirty);

  useEffect(() => {
    setBrandDraft(storefront.brandText ?? "");
    setNotifEmailDraft(storefront.notificationEmail ?? "");
    setNotifSendDraft(storefront.sendOrderEmails ?? false);
    const pickup = pickupFieldsFromStorefront(storefront.pickupAddress);
    setPickupStreet(pickup.street);
    setPickupHouseNumber(pickup.houseNumber);
    setPickupCity(pickup.city);
    setPickupPostCode(pickup.postCode);
    setPickupCountry(pickup.country);
    setSelectedShapeKeys(new Set(storefront.shapes.map((s) => shapeRecordKey(s))));
  }, [
    storefront.id,
    storefront.brandText,
    storefront.notificationEmail,
    storefront.sendOrderEmails,
    storefront.pickupAddress,
    storefront.shapes,
  ]);

  function toggleShape(key: string) {
    setSelectedShapeKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    setSavedMessage("");

    const pricingValidation = pricingRef.current?.validate();
    if (!pricingValidation?.ok) {
      setFormError(pricingValidation?.error ?? "Set valid pricing");
      return;
    }

    const configIssues = getEventConfigurationIssues({
      selectedShapeCount: selectedShapeKeys.size,
      hasPricing: true,
      sendOrderEmails: notifSendDraft,
      notificationEmail: notifEmailDraft,
    });

    if (configIssues.length > 0) {
      setFormError(configIssues.join(". "));
      return;
    }

    const pickupError = validateOptionalStructuredAddress(pickupDraft);
    if (pickupError) {
      setFormError(pickupError);
      return;
    }

    setSaving(true);

    try {
      await api<{ storefront: StorefrontConfigurationStorefront }>(
        `/api/storefronts/${storefront.id}`,
        {
          method: "PATCH",
          body: {
            ...(canCustomBrand && {
              brandText: brandDraft.trim() === "" ? null : brandDraft.trim(),
            }),
            ...(canEmailNotif && {
              sendOrderEmails: notifSendDraft,
              notificationEmail:
                notifEmailDraft.trim() === "" ? null : notifEmailDraft.trim(),
            }),
            pickupAddress: optionalStructuredAddressPayload(pickupDraft),
          },
        },
      );

      await syncStorefrontShapes(
        storefront.id,
        storefront.shapes,
        selectedShapeKeys,
      );

      const pricingResult = await savePricingConfiguration(
        "storefront",
        storefront.id,
        pricingValidation.payload,
      );

      const refreshed = await api<{ storefront: StorefrontConfigurationStorefront }>(
        `/api/storefronts/${storefront.id}`,
      );

      onSaved({
        ...refreshed.storefront,
        maxMagnetsPerOrder:
          pricingValidation.payload.mode === "PER_ITEM"
            ? (pricingResult.maxMagnetsPerOrder ??
              refreshed.storefront.maxMagnetsPerOrder)
            : refreshed.storefront.maxMagnetsPerOrder,
        pricing: pricingResult.pricing,
      });
      setSavedMessage("Configuration saved.");
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Could not save configuration",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-8">
      {!storefront.configurationComplete ? (
        <div
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          role="status"
        >
          <p className="font-medium">Configuration incomplete</p>
          <p className="mt-1 text-amber-900/90">
            Customers cannot place orders until at least one shape and pricing are
            saved. Complete the sections below and click Save configuration.
          </p>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <section className="dashboard-card space-y-8">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Print branding</h2>
            {canCustomBrand ? (
              <>
                <p className="mt-1 text-xs text-muted-foreground">
                  Shown on seller PDF print sheets. Max 40 characters. Empty uses
                  default <span className="font-mono">@magnetooprints</span>.
                </p>
                <label className="mt-4 flex flex-col gap-1">
                  <span className="text-xs font-medium text-muted-foreground">Brand line</span>
                  <input
                    type="text"
                    value={brandDraft}
                    onChange={(e) => setBrandDraft(e.target.value.slice(0, 40))}
                    maxLength={40}
                    placeholder="@magnetooprints"
                    className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none ring-primary focus:ring-2"
                  />
                </label>
              </>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                Free plan uses <span className="font-medium">{FREE_PRINT_BRAND_TEXT}</span> on
                print PDFs.{" "}
                <Link href="/dashboard/billing" className="text-primary hover:underline">
                  Upgrade to Hobby
                </Link>{" "}
                for custom branding.
              </p>
            )}
          </div>

          <div className="border-t border-border pt-8">
            <h2 className="text-sm font-semibold text-foreground">Order notifications</h2>
            {canEmailNotif ? (
              <>
                <p className="mt-1 text-xs text-muted-foreground">
                  Email alerts when a customer places an order.
                </p>
                <label className="mt-4 flex cursor-pointer items-start gap-2">
                  <input
                    type="checkbox"
                    className="mt-0.5 rounded border-border text-primary focus:ring-primary"
                    checked={notifSendDraft}
                    onChange={(e) => setNotifSendDraft(e.target.checked)}
                  />
                  <span className="text-sm text-foreground">Send new-order emails</span>
                </label>
                <label className="mt-4 flex flex-col gap-1">
                  <span className="text-xs font-medium text-muted-foreground">
                    Notification email
                    {notifSendDraft ? " (required)" : ""}
                  </span>
                  <input
                    type="email"
                    value={notifEmailDraft}
                    onChange={(e) => setNotifEmailDraft(e.target.value)}
                    placeholder="seller@example.com"
                    autoComplete="email"
                    required={notifSendDraft}
                    className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none ring-primary focus:ring-2"
                  />
                </label>
              </>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                Email alerts are available on Hobby and Pro.{" "}
                <Link href="/dashboard/billing" className="text-primary hover:underline">
                  View plans
                </Link>
              </p>
            )}
          </div>

          <div className="border-t border-border pt-8">
            <h2 className="text-sm font-semibold text-foreground">Pickup address</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Shown to customers who choose Pickup at checkout.
            </p>
            {pickupFieldsEmpty ? (
              <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                Pickup won&apos;t be offered at checkout until you add a full
                address.
              </p>
            ) : null}
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 sm:col-span-2">
                <span className="text-xs font-medium text-muted-foreground">Street</span>
                <input
                  type="text"
                  value={pickupStreet}
                  onChange={(e) => setPickupStreet(e.target.value)}
                  autoComplete="address-line1"
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none ring-primary focus:ring-2"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground">
                  House number
                </span>
                <input
                  type="text"
                  value={pickupHouseNumber}
                  onChange={(e) => setPickupHouseNumber(e.target.value)}
                  autoComplete="off"
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none ring-primary focus:ring-2"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground">City</span>
                <input
                  type="text"
                  value={pickupCity}
                  onChange={(e) => setPickupCity(e.target.value)}
                  autoComplete="address-level2"
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none ring-primary focus:ring-2"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground">
                  Post code
                </span>
                <input
                  type="text"
                  value={pickupPostCode}
                  onChange={(e) => setPickupPostCode(e.target.value)}
                  autoComplete="postal-code"
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none ring-primary focus:ring-2"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground">
                  Country
                </span>
                <input
                  type="text"
                  value={pickupCountry}
                  onChange={(e) => setPickupCountry(e.target.value)}
                  autoComplete="country-name"
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none ring-primary focus:ring-2"
                />
              </label>
            </div>
          </div>

          <div className="border-t border-border pt-8">
            <h2 className="text-sm font-semibold text-foreground">Shapes</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              All four magnet sizes are available on every plan.
            </p>
            <fieldset className="mt-4 space-y-2">
              {shapePresets.map((preset) => {
                const key = shapePresetKey(preset.value);
                const checked = selectedShapeKeys.has(key);
                return (
                  <label
                    key={key}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                      checked
                        ? "border-primary text-foreground"
                        : "border-border text-muted-foreground hover:border-muted-foreground"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleShape(key)}
                      className="sr-only"
                    />
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                        checked
                          ? "border-primary bg-primary"
                          : "border-border"
                      }`}
                    >
                      {checked ? (
                        <svg
                          className="h-3.5 w-3.5 text-white"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={3}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      ) : null}
                    </span>
                    <span className="min-w-0 leading-snug">{preset.label}</span>
                  </label>
                );
              })}
            </fieldset>
            {selectedShapeKeys.size === 0 ? (
              <p className="mt-3 text-xs text-[#DC2626]">Select at least one shape.</p>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">
                {selectedShapeKeys.size} shape
                {selectedShapeKeys.size === 1 ? "" : "s"} selected
              </p>
            )}
          </div>
        </section>

        <div className="flex min-w-0 flex-col gap-6">
          <section className="dashboard-card min-w-0">
            <h2 className="text-sm font-semibold text-foreground">Pricing</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              How customers are charged for their magnets.
            </p>
            <div className="mt-4 space-y-4">
              {(storefront.pricing ?? []).length > 0 ? (
                <PricingPreview pricing={storefront.pricing ?? []} />
              ) : null}
              <PricingEditor
                ref={pricingRef}
                embedded
                contextType="storefront"
                contextId={storefront.id}
                currency={orgCurrency}
                initialPricing={storefront.pricing ?? []}
                initialMaxMagnetsPerOrder={storefront.maxMagnetsPerOrder ?? null}
                onDirtyChange={setPricingDirty}
              />
            </div>
          </section>
        </div>
      </div>

      {formError ? (
        <p className="text-sm text-[#DC2626]" role="alert">
          {formError}
        </p>
      ) : null}
      {savedMessage ? (
        <p className="text-sm text-[#16A34A]" role="status">
          {savedMessage}
        </p>
      ) : null}

      <div className="flex items-center gap-3 border-t border-border pt-6">
        <button
          type="submit"
          disabled={saving}
          className="min-h-[44px] rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#1d4ed8] disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save configuration"}
        </button>
      </div>
    </form>
  );
}
