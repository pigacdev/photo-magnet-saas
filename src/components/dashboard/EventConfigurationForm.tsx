"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { getEventConfigurationIssues } from "@/lib/eventConfiguration";
import {
  useUnsavedChangesWarning,
} from "@/hooks/useUnsavedChangesWarning";
import {
  SHAPE_PRESETS,
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
import { ShareLinkCard } from "@/components/dashboard/ShareLinkCard";
import Link from "next/link";
import { getCachedOrganizationUsage } from "@/lib/auth";
import { FREE_PRINT_BRAND_TEXT } from "@/lib/planCatalog";
import { usageHasFeature } from "@/lib/planFeatures";
import { getPlanUsageLevel } from "@/lib/planUsage";

type AllowedShape = {
  id: string;
  shapeType: string;
  widthMm: number;
  heightMm: number;
  displayOrder: number;
};

export type EventConfigurationEvent = {
  id: string;
  name: string;
  brandText: string | null;
  notificationEmail: string | null;
  sendOrderEmails: boolean;
  startDate: string;
  endDate: string;
  isActive: boolean;
  isOpen: boolean;
  status: "upcoming" | "active" | "ended" | "inactive";
  configurationComplete?: boolean;
  maxMagnetsPerOrder: number | null;
  shapes: AllowedShape[];
  pricing: PricingRule[];
};

type EventConfigurationFormProps = {
  event: EventConfigurationEvent;
  publicEntryUrl: string;
  onSaved: (event: EventConfigurationEvent) => void;
  onDirtyChange?: (dirty: boolean) => void;
};

function shapeKeySetsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const key of a) {
    if (!b.has(key)) return false;
  }
  return true;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

async function syncEventShapes(
  eventId: string,
  currentShapes: AllowedShape[],
  selectedKeys: Set<string>,
) {
  const currentByKey = new Map(
    currentShapes.map((s) => [shapeRecordKey(s), s]),
  );

  const toRemove = currentShapes.filter(
    (s) => !selectedKeys.has(shapeRecordKey(s)),
  );
  const toAdd = SHAPE_PRESETS.filter(
    (p) =>
      selectedKeys.has(shapePresetKey(p.value)) &&
      !currentByKey.has(shapePresetKey(p.value)),
  );

  for (const shape of toRemove) {
    await api(`/api/events/${eventId}/shapes/${shape.id}`, { method: "DELETE" });
  }

  for (const preset of toAdd) {
    await api(`/api/events/${eventId}/shapes`, {
      method: "POST",
      body: preset.value,
    });
  }
}

export function EventConfigurationForm({
  event,
  publicEntryUrl,
  onSaved,
  onDirtyChange,
}: EventConfigurationFormProps) {
  const pricingRef = useRef<PricingEditorHandle>(null);
  const usage = getCachedOrganizationUsage();
  const orgCurrency = usage?.currency ?? "EUR";
  const canCustomBrand = usageHasFeature(usage, "custom_branding");
  const canEmailNotif = usageHasFeature(usage, "email_notifications");

  const [brandDraft, setBrandDraft] = useState(event.brandText ?? "");
  const [notifEmailDraft, setNotifEmailDraft] = useState(
    event.notificationEmail ?? "",
  );
  const [notifSendDraft, setNotifSendDraft] = useState(
    event.sendOrderEmails ?? false,
  );
  const [selectedShapeKeys, setSelectedShapeKeys] = useState<Set<string>>(
    () => new Set(event.shapes.map((s) => shapeRecordKey(s))),
  );
  const [pricingDirty, setPricingDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [savedMessage, setSavedMessage] = useState("");

  const savedShapeKeys = useMemo(
    () => new Set(event.shapes.map((s) => shapeRecordKey(s))),
    [event.shapes],
  );

  const isDirty = useMemo(() => {
    const shapesDirty = !shapeKeySetsEqual(savedShapeKeys, selectedShapeKeys);
    const brandDirty = (event.brandText ?? "") !== brandDraft.trim();
    const emailDirty =
      (event.notificationEmail ?? "") !== notifEmailDraft.trim();
    const sendDirty = (event.sendOrderEmails ?? false) !== notifSendDraft;
    return shapesDirty || brandDirty || emailDirty || sendDirty || pricingDirty;
  }, [
    pricingDirty,
    savedShapeKeys,
    selectedShapeKeys,
    event.brandText,
    event.notificationEmail,
    event.sendOrderEmails,
    brandDraft,
    notifEmailDraft,
    notifSendDraft,
  ]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  useUnsavedChangesWarning(isDirty);

  useEffect(() => {
    setBrandDraft(event.brandText ?? "");
    setNotifEmailDraft(event.notificationEmail ?? "");
    setNotifSendDraft(event.sendOrderEmails ?? false);
    setSelectedShapeKeys(new Set(event.shapes.map((s) => shapeRecordKey(s))));
  }, [event.id, event.brandText, event.notificationEmail, event.sendOrderEmails, event.shapes]);

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

    setSaving(true);

    try {
      await api<{ event: EventConfigurationEvent }>(`/api/events/${event.id}`, {
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
        },
      });

      await syncEventShapes(event.id, event.shapes, selectedShapeKeys);

      const pricingResult = await savePricingConfiguration(
        "event",
        event.id,
        pricingValidation.payload,
      );

      const refreshed = await api<{ event: EventConfigurationEvent }>(
        `/api/events/${event.id}`,
      );

      onSaved({
        ...refreshed.event,
        maxMagnetsPerOrder:
          pricingValidation.payload.mode === "PER_ITEM"
            ? (pricingResult.maxMagnetsPerOrder ?? refreshed.event.maxMagnetsPerOrder)
            : refreshed.event.maxMagnetsPerOrder,
        pricing: pricingResult.pricing,
      });
      setSavedMessage("Configuration saved.");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not save configuration");
    } finally {
      setSaving(false);
    }
  }

  const ordersReady =
    event.configurationComplete === true && event.isOpen === true;
  const monthlyLimitReached =
    usage != null && getPlanUsageLevel(usage) === "reached";

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-8">
      {!event.configurationComplete ? (
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

      <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
        <section className="dashboard-card">
          <h2 className="text-sm font-semibold text-foreground">Schedule</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            When this event accepts customer orders
          </p>
          <dl className="mt-4 space-y-3">
            <div className="rounded-lg border border-border bg-surface px-4 py-3">
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Start
              </dt>
              <dd className="mt-1 text-sm text-foreground">{formatDate(event.startDate)}</dd>
            </div>
            <div className="rounded-lg border border-border bg-surface px-4 py-3">
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                End
              </dt>
              <dd className="mt-1 text-sm text-foreground">{formatDate(event.endDate)}</dd>
            </div>
          </dl>
        </section>

        <section className="dashboard-card">
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
        </section>

        {canEmailNotif ? (
          <section className="dashboard-card">
            <h2 className="text-sm font-semibold text-foreground">Order notifications</h2>
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
          </section>
        ) : (
          <section className="dashboard-card">
            <h2 className="text-sm font-semibold text-foreground">Order notifications</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Email alerts are available on Hobby and Pro.{" "}
              <Link href="/dashboard/billing" className="text-primary hover:underline">
                View plans
              </Link>
            </p>
          </section>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
        <section className="dashboard-card">
          <h2 className="text-sm font-semibold text-foreground">Shapes</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            All four magnet sizes are available on every plan.
          </p>
          <fieldset className="mt-4 space-y-2">
            {SHAPE_PRESETS.map((preset) => {
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
              {selectedShapeKeys.size} shape{selectedShapeKeys.size === 1 ? "" : "s"}{" "}
              selected
            </p>
          )}
        </section>

        <section className="dashboard-card min-w-0">
          <h2 className="text-sm font-semibold text-foreground">Pricing</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            How customers are charged for their magnets.
          </p>
          <div className="mt-4 space-y-4">
            {(event.pricing ?? []).length > 0 ? (
              <PricingPreview pricing={event.pricing ?? []} />
            ) : null}
            <PricingEditor
              ref={pricingRef}
              embedded
              contextType="event"
              contextId={event.id}
              currency={orgCurrency}
              initialPricing={event.pricing ?? []}
              initialMaxMagnetsPerOrder={event.maxMagnetsPerOrder ?? null}
              onDirtyChange={setPricingDirty}
            />
          </div>
        </section>

        <ShareLinkCard
          label="Customer link"
          publicUrl={publicEntryUrl}
          variant="event"
          entityName={event.name}
          entityId={event.id}
          ordersEnabled={ordersReady}
          monthlyLimitReached={monthlyLimitReached}
        />
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
