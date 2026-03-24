"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export default function NewStorefrontPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Storefront name is required");
      return;
    }

    setLoading(true);
    try {
      await api("/api/storefronts", {
        method: "POST",
        body: { name: name.trim() },
      });
      router.push("/dashboard/storefronts");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create storefront");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-semibold tracking-tight text-[#111111]">
        Create storefront
      </h1>
      <p className="mt-2 text-sm text-[#6B7280]">
        Set up a permanent storefront for ongoing photo magnet sales.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-[#111111]">
            Storefront name
          </label>
          <input
            id="name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1.5 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-[#111111] placeholder:text-[#6B7280] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] focus:outline-none"
            placeholder="e.g. My Photo Booth"
          />
        </div>

        {error && <p className="text-sm text-[#DC2626]">{error}</p>}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-[#2563EB] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#1d4ed8] disabled:opacity-50"
          >
            {loading ? "Creating…" : "Create storefront"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/dashboard/storefronts")}
            className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-[#111111] transition-colors hover:bg-[#F9FAFB]"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
