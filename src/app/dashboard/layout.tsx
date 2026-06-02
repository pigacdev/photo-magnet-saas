"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getMe,
  getCachedOrganizationUsage,
  type User,
  type OrganizationUsage,
} from "@/lib/auth";
import { DashboardShell } from "@/components/dashboard/DashboardShell";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [usage, setUsage] = useState<OrganizationUsage | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    getMe().then((u) => {
      if (!u) {
        router.replace("/login");
      } else {
        setUser(u);
        setUsage(getCachedOrganizationUsage());
        setChecking(false);
      }
    });
  }, [router]);

  function refreshUsage() {
    setUsage(getCachedOrganizationUsage());
  }

  if (checking) {
    return (
      <div className="flex min-h-full flex-1 items-center justify-center bg-surface p-6">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!user) return null;

  return (
    <DashboardShell user={user} usage={usage} onUsageRefresh={refreshUsage}>
      {children}
    </DashboardShell>
  );
}
