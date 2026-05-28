"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { StorefrontConfigurationForm } from "@/components/dashboard/StorefrontConfigurationForm";
import { confirmUnsavedChanges } from "@/hooks/useUnsavedChangesWarning";
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
  shapes: AllowedShape[];
  pricing: PricingRule[];
};

export default function StorefrontDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [storefront, setStorefront] = useState<Storefront | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [publicEntryUrl, setPublicEntryUrl] = useState("");
  const [configDirty, setConfigDirty] = useState(false);

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

  const leaveIfAllowed = useCallback(
    (action: () => void) => {
      if (configDirty && !confirmUnsavedChanges()) return;
      action();
    },
    [configDirty],
  );

  async function handleToggleActive() {
    if (!storefront) return;
    const updated = await api<{ storefront: Storefront }>(
      `/api/storefronts/${storefront.id}`,
      { method: "PATCH", body: { isActive: !storefront.isActive } },
    );
    setStorefront({
      ...storefront,
      ...updated.storefront,
      shapes: updated.storefront.shapes ?? storefront.shapes,
      pricing: updated.storefront.pricing ?? storefront.pricing,
    });
  }

  async function handleDelete() {
    if (!storefront) return;
    leaveIfAllowed(async () => {
      await api(`/api/storefronts/${storefront.id}`, { method: "DELETE" });
      router.push("/dashboard/storefronts");
    });
  }

  if (loading) {
    return <p className="text-sm text-[#6B7280]">Loading…</p>;
  }

  if (error || !storefront) {
    return (
      <div>
        <p className="text-sm text-[#DC2626]">{error || "Storefront not found"}</p>
        <Link href="/dashboard/storefronts" className="mt-2 inline-block text-sm text-[#2563EB]">
          Back to storefronts
        </Link>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <div>
        <Link
          href="/dashboard/storefronts"
          className="-ml-1 inline-block rounded-md px-1 py-0.5 text-sm text-[#6B7280] transition-colors hover:bg-[#F9FAFB] hover:text-[#111111]"
          onClick={(e) => {
            if (configDirty && !confirmUnsavedChanges()) {
              e.preventDefault();
            }
          }}
        >
          &larr; All storefronts
        </Link>

        <div className="mt-4 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[#111111]">
              {storefront.name}
            </h1>
            <div className="mt-2">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  storefront.isOpen
                    ? "bg-green-50 text-[#16A34A]"
                    : "bg-gray-100 text-[#6B7280]"
                }`}
              >
                {storefront.isOpen ? "Open" : "Closed"}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void handleToggleActive()}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-[#111111] transition-colors hover:bg-[#F9FAFB]"
            >
              {storefront.isActive ? "Deactivate" : "Activate"}
            </button>
            <button
              type="button"
              onClick={() => void handleDelete()}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-[#DC2626] transition-colors hover:bg-red-50"
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      <StorefrontConfigurationForm
        storefront={storefront}
        publicEntryUrl={publicEntryUrl}
        onSaved={(updated) => setStorefront(updated as Storefront)}
        onDirtyChange={setConfigDirty}
      />
    </div>
  );
}
