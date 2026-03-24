"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

type Storefront = {
  id: string;
  name: string;
  isActive: boolean;
  isOpen: boolean;
  createdAt: string;
};

export default function StorefrontsPage() {
  const [storefronts, setStorefronts] = useState<Storefront[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ storefronts: Storefront[] }>("/api/storefronts")
      .then((data) => setStorefronts(data.storefronts))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-[#111111]">
          Storefronts
        </h1>
        <Link
          href="/dashboard/storefronts/new"
          className="rounded-lg bg-[#2563EB] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#1d4ed8]"
        >
          Create storefront
        </Link>
      </div>

      {loading ? (
        <p className="mt-8 text-sm text-[#6B7280]">Loading…</p>
      ) : storefronts.length === 0 ? (
        <div className="mt-16 text-center">
          <p className="text-[#6B7280]">No storefronts yet.</p>
          <p className="mt-1 text-sm text-[#6B7280]">
            Create a storefront for your permanent photo magnet shop.
          </p>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-lg border border-gray-200">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-[#F9FAFB]">
              <tr>
                <th className="px-4 py-3 font-medium text-[#6B7280]">Name</th>
                <th className="px-4 py-3 font-medium text-[#6B7280]">Status</th>
                <th className="px-4 py-3 font-medium text-[#6B7280]">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {storefronts.map((sf) => (
                <tr key={sf.id} className="hover:bg-[#F9FAFB]">
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/storefronts/${sf.id}`}
                      className="font-medium text-[#111111] hover:text-[#2563EB]"
                    >
                      {sf.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        sf.isOpen
                          ? "bg-green-50 text-[#16A34A]"
                          : "bg-gray-100 text-[#6B7280]"
                      }`}
                    >
                      {sf.isOpen ? "Open" : "Closed"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#6B7280]">
                    {new Date(sf.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
