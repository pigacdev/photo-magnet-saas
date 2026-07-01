"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { api, apiFormData } from "@/lib/api";

type EventBannerUploadProps = {
  eventId: string;
  bannerUrl: string | null;
  canUpload: boolean;
  onBannerChange: (bannerUrl: string | null) => void;
};

export function EventBannerUpload({
  eventId,
  bannerUrl,
  canUpload,
  onBannerChange,
}: EventBannerUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState("");

  async function onFileSelected(files: FileList | null) {
    const file = files?.[0];
    if (!file || !canUpload) return;

    setUploading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await apiFormData<{ bannerUrl: string }>(
        `/api/events/${eventId}/banner`,
        fd,
      );
      onBannerChange(res.bannerUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function removeBanner() {
    if (!bannerUrl || !canUpload) return;
    setRemoving(true);
    setError("");
    try {
      await api(`/api/events/${eventId}/banner`, { method: "DELETE" });
      onBannerChange(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove banner");
    } finally {
      setRemoving(false);
    }
  }

  if (!canUpload) {
    return (
      <p className="mt-2 text-sm text-muted-foreground">
        Custom event banners are available on Hobby and Pro.{" "}
        <Link href="/dashboard/billing" className="text-primary hover:underline">
          Upgrade to Hobby
        </Link>
        .
      </p>
    );
  }

  const busy = uploading || removing;

  return (
    <div className="mt-4 space-y-3">
      <p className="text-xs text-muted-foreground">
        Wide image (~3:1) shown at the top of your customer link page. JPG or PNG,
        max 2 MB.
      </p>

      {bannerUrl ? (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={bannerUrl}
            src={bannerUrl}
            alt=""
            className="aspect-[3/1] w-full object-cover"
          />
        </div>
      ) : null}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png"
        className="sr-only"
        disabled={busy}
        onChange={(e) => void onFileSelected(e.target.files)}
      />

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => fileInputRef.current?.click()}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface disabled:opacity-50"
        >
          {uploading ? "Uploading…" : bannerUrl ? "Replace banner" : "Upload banner"}
        </button>
        {bannerUrl ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void removeBanner()}
            className="rounded-lg px-3 py-2 text-sm font-medium text-[#DC2626] transition-colors hover:bg-red-50 disabled:opacity-50"
          >
            {removing ? "Removing…" : "Remove banner"}
          </button>
        ) : null}
      </div>

      {error ? (
        <p className="text-xs text-[#DC2626]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
