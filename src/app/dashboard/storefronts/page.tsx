"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSellerStorefront } from "@/hooks/useSellerStorefront";

export default function StorefrontsPage() {
  const router = useRouter();
  const { storefront, loading } = useSellerStorefront();

  useEffect(() => {
    if (!loading && storefront) {
      router.replace(`/dashboard/storefronts/${storefront.id}`);
    }
  }, [loading, storefront, router]);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  if (storefront) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <div className="flex min-h-[min(24rem,calc(100vh-12rem))] flex-col items-center justify-center px-4 text-center">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Storefront
      </h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        Create a storefront for your permanent photo magnet shop.
      </p>
      <Link
        href="/dashboard/storefronts/new"
        className="mt-8 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#1d4ed8]"
      >
        Create storefront
      </Link>
    </div>
  );
}
