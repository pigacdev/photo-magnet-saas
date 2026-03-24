"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

type Storefront = {
  id: string;
  name: string;
  isActive: boolean;
  isOpen: boolean;
  createdAt: string;
};

export default function StorefrontsPage() {
  const router = useRouter();
  const [storefronts, setStorefronts] = useState<Storefront[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ storefronts: Storefront[] }>("/api/storefronts")
      .then((data) => setStorefronts(data.storefronts))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col gap-8">
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
        <p className="text-sm text-[#6B7280]">Loading…</p>
      ) : storefronts.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-[#6B7280]">No storefronts yet.</p>
          <p className="mt-1 text-sm text-[#6B7280]">
            Create a storefront for your permanent photo magnet shop.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-[#F9FAFB]">
              <tr>
                <th className="px-4 py-3 font-medium text-[#6B7280]">Name</th>
                <th className="px-4 py-3 font-medium text-[#6B7280]">Status</th>
                <th className="px-4 py-3 font-medium text-[#6B7280]">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {storefronts
                .filter((sf) => sf.id)
                .map((sf) => {
                  const href = `/dashboard/storefronts/${sf.id}`;
                  return (
                    <tr
                      key={sf.id}
                      role="link"
                      tabIndex={0}
                      aria-label={`Open storefront ${sf.name}`}
                      className="cursor-pointer hover:bg-[#F9FAFB] focus-visible:bg-[#F9FAFB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2"
                      onClick={() => router.push(href)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          router.push(href);
                        }
                      }}
                    >
                      <td className="px-4 py-3">
                        <span className="font-medium text-[#111111]">{sf.name}</span>
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
                  );
                })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
