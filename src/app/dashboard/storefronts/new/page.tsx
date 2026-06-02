"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useSellerStorefront } from "@/hooks/useSellerStorefront";

export default function NewStorefrontPage() {
  const router = useRouter();
  const { storefront, loading: resolvingStorefront } = useSellerStorefront();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!resolvingStorefront && storefront) {
      router.replace(`/dashboard/storefronts/${storefront.id}`);
    }
  }, [resolvingStorefront, storefront, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Storefront name is required");
      return;
    }

    setLoading(true);
    try {
      const created = await api<{ storefront: { id: string } }>("/api/storefronts", {
        method: "POST",
        body: { name: name.trim() },
      });
      router.push(`/dashboard/storefronts/${created.storefront.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create storefront";
      if (message.toLowerCase().includes("already has a storefront")) {
        setError("You already have a storefront.");
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }

  if (resolvingStorefront || storefront) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <div className="dashboard-page mx-auto max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Create storefront
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Set a name first. You will configure shapes, pricing, and other settings
          on the next screen.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-foreground">
            Storefront name
          </label>
          <input
            id="name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1.5 block w-full rounded-lg border border-border px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
            placeholder="e.g. My Photo Booth"
          />
        </div>

        {error && <p className="text-sm text-[#DC2626]">{error}</p>}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#1d4ed8] disabled:opacity-50"
          >
            {loading ? "Creating…" : "Create storefront"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/dashboard/storefronts")}
            className="rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-surface"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
