"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import {
  getCachedOrganizationUsage,
  getMe,
  subscribeOrganizationUsage,
} from "@/lib/auth";
import { getPlanUsageLevel } from "@/lib/planUsage";
import { CustomerLinkBanner } from "@/components/dashboard/CustomerLinkBanner";
import { StorefrontConfigurationForm } from "@/components/dashboard/StorefrontConfigurationForm";
import { StorefrontVacationDisableModal } from "@/components/dashboard/StorefrontVacationDisableModal";
import { StorefrontVacationEnableModal } from "@/components/dashboard/StorefrontVacationEnableModal";
import { StorefrontVacationModeBanner } from "@/components/dashboard/StorefrontVacationModeBanner";
import type { PricingRule } from "@/components/PricingEditor";

type AllowedShape = {
  id: string;
  shapeType: string;
  widthMm: number;
  heightMm: number;
  displayOrder: number;
};

type Storefront = {
  id: string;
  name: string;
  brandText: string | null;
  notificationEmail: string | null;
  sendOrderEmails: boolean;
  isActive: boolean;
  isOpen: boolean;
  configurationComplete?: boolean;
  canUseVacationMode: boolean;
  vacationScheduled: boolean;
  isVacationMode: boolean;
  vacationFrom: string | null;
  vacationTo: string | null;
  vacationNote: string | null;
  createdAt: string;
  maxMagnetsPerOrder: number | null;
  pickupAddress: {
    street: string;
    houseNumber: string;
    city: string;
    postCode: string;
    country: string;
  } | null;
  shapes: AllowedShape[];
  pricing: PricingRule[];
};

export default function StorefrontDetailPage() {
  const params = useParams();
  const [storefront, setStorefront] = useState<Storefront | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [publicEntryUrl, setPublicEntryUrl] = useState("");
  const [usage, setUsage] = useState(() => getCachedOrganizationUsage());
  const [enableModalOpen, setEnableModalOpen] = useState(false);
  const [disableModalOpen, setDisableModalOpen] = useState(false);
  const [vacationLoading, setVacationLoading] = useState(false);

  useEffect(() => {
    void getMe().then(() => setUsage(getCachedOrganizationUsage()));
    return subscribeOrganizationUsage(() => {
      setUsage(getCachedOrganizationUsage());
    });
  }, []);

  useEffect(() => {
    api<{ storefront: Storefront }>(`/api/storefronts/${params.id}`)
      .then((data) => setStorefront(data.storefront))
      .catch(() => setError("Storefront not found"))
      .finally(() => setLoading(false));
  }, [params.id]);

  useEffect(() => {
    if (!storefront?.id) {
      setPublicEntryUrl("");
      return;
    }
    setPublicEntryUrl(`${window.location.origin}/store/${storefront.id}`);
  }, [storefront?.id]);

  async function updateVacation(body: {
    vacationFrom: string | null;
    vacationTo: string | null;
    vacationNote: string | null;
  }) {
    if (!storefront) return;
    setVacationLoading(true);
    try {
      const updated = await api<{ storefront: Storefront }>(
        `/api/storefronts/${storefront.id}`,
        { method: "PATCH", body },
      );
      setStorefront({
        ...storefront,
        ...updated.storefront,
        shapes: updated.storefront.shapes ?? storefront.shapes,
        pricing: updated.storefront.pricing ?? storefront.pricing,
      });
      setEnableModalOpen(false);
      setDisableModalOpen(false);
    } finally {
      setVacationLoading(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  if (error || !storefront) {
    return (
      <div>
        <p className="text-sm text-[#DC2626]">{error || "Storefront not found"}</p>
        <Link href="/dashboard/storefronts" className="mt-2 inline-block text-sm text-primary">
          Back to storefront
        </Link>
      </div>
    );
  }

  const ordersReady =
    storefront.configurationComplete === true && storefront.isOpen === true;
  const monthlyLimitReached =
    usage != null && getPlanUsageLevel(usage) === "reached";

  const statusBadge = storefront.isVacationMode
    ? {
        label: "Vacation",
        className:
          "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
      }
    : storefront.isOpen
      ? {
          label: "Open",
          className:
            "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400",
        }
      : {
          label: "Closed",
          className: "bg-surface text-muted-foreground",
        };

  return (
    <div className="dashboard-page">
      <div>
        {ordersReady && !storefront.isVacationMode ? (
          <CustomerLinkBanner
            publicUrl={publicEntryUrl}
            variant="storefront"
            entityName={storefront.name}
            entityId={storefront.id}
            monthlyLimitReached={monthlyLimitReached}
            className="mb-4"
          />
        ) : null}

        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {storefront.name}
        </h1>
        <div className="mt-2">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadge.className}`}
          >
            {statusBadge.label}
          </span>
        </div>
      </div>

      <StorefrontConfigurationForm
        storefront={storefront}
        onSaved={(updated) => setStorefront(updated as Storefront)}
        afterPricing={
          <StorefrontVacationModeBanner
            canUseVacationMode={storefront.canUseVacationMode}
            vacationScheduled={storefront.vacationScheduled}
            isVacationMode={storefront.isVacationMode}
            vacationFrom={storefront.vacationFrom}
            vacationTo={storefront.vacationTo}
            vacationNote={storefront.vacationNote}
            dateFormat={usage?.dateFormat}
            onEnableClick={() => setEnableModalOpen(true)}
            onDisableClick={() => setDisableModalOpen(true)}
            className=""
          />
        }
      />

      <StorefrontVacationEnableModal
        open={enableModalOpen}
        loading={vacationLoading}
        onClose={() => {
          if (!vacationLoading) setEnableModalOpen(false);
        }}
        onConfirm={(input) => void updateVacation(input)}
      />

      <StorefrontVacationDisableModal
        open={disableModalOpen}
        loading={vacationLoading}
        onClose={() => {
          if (!vacationLoading) setDisableModalOpen(false);
        }}
        onConfirm={() =>
          void updateVacation({
            vacationFrom: null,
            vacationTo: null,
            vacationNote: null,
          })
        }
      />
    </div>
  );
}
