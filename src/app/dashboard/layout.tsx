"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { getMe, logout, type User } from "@/lib/auth";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Home" },
  { href: "/dashboard/events", label: "Events" },
  { href: "/dashboard/storefronts", label: "Storefronts" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    getMe().then((u) => {
      if (!u) {
        router.replace("/login");
      } else {
        setUser(u);
        setChecking(false);
      }
    });
  }, [router]);

  const pathname = usePathname();

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  if (checking) {
    return (
      <div className="flex min-h-full flex-1 items-center justify-center">
        <p className="text-sm text-[#6B7280]">Loading…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex h-14 max-w-[1200px] items-center justify-between px-4">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="text-base font-semibold text-[#111111]">
              Photo Magnet
            </Link>
            <nav className="flex items-center gap-1">
              {NAV_ITEMS.map((item) => {
                const isActive =
                  item.href === "/dashboard"
                    ? pathname === "/dashboard"
                    : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-[#F9FAFB] text-[#111111]"
                        : "text-[#6B7280] hover:text-[#111111]"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm text-[#6B7280]">
              {user?.name || user?.email}
            </span>
            <button
              onClick={handleLogout}
              className="text-sm font-medium text-[#6B7280] transition-colors hover:text-[#111111]"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-8">
        {children}
      </main>
    </div>
  );
}
