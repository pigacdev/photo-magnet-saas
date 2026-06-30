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

  return (
    <div className="dashboard-page">
      <div>
        {ordersReady ? (
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
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
              storefront.isOpen
                ? "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400"
                : "bg-surface text-muted-foreground"
            }`}
          >
            {storefront.isOpen ? "Open" : "Closed"}
          </span>
        </div>
      </div>

      <StorefrontConfigurationForm
        storefront={storefront}
        onSaved={(updated) => setStorefront(updated as Storefront)}
      />
    </div>
  );
}
