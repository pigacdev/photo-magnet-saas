"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

export type NewOrderNotificationItem = {
  id: string;
  customerName: string | null;
  createdAt: string;
  totalPrice: string;
  currency: string;
  magnetCount: number;
};

type RecentOrdersResponse = {
  items: NewOrderNotificationItem[];
};

const POLL_INTERVAL_MS = 30_000;

export function useNewOrderNotifications() {
  const [queue, setQueue] = useState<NewOrderNotificationItem[]>([]);
  const lastSeenAtRef = useRef<Date>(new Date());
  const seenIdsRef = useRef<Set<string>>(new Set());
  const pollingRef = useRef(false);

  const dismissNotification = useCallback((id: string) => {
    setQueue((prev) => prev.filter((item) => item.id !== id));
  }, []);

  useEffect(() => {
    async function poll() {
      if (pollingRef.current || document.hidden) return;
      pollingRef.current = true;
      try {
        const since = lastSeenAtRef.current.toISOString();
        const data = await api<RecentOrdersResponse>(
          `/api/orders/recent?since=${encodeURIComponent(since)}`,
        );

        const fresh = data.items.filter((item) => !seenIdsRef.current.has(item.id));
        if (fresh.length > 0) {
          for (const item of fresh) {
            seenIdsRef.current.add(item.id);
          }
          const latestCreatedAt = fresh.reduce((latest, item) => {
            const t = new Date(item.createdAt).getTime();
            return t > latest ? t : latest;
          }, lastSeenAtRef.current.getTime());
          lastSeenAtRef.current = new Date(latestCreatedAt);
          setQueue((prev) => [...prev, ...fresh]);
        }
      } catch {
        /* ignore transient poll failures */
      } finally {
        pollingRef.current = false;
      }
    }

    const intervalId = window.setInterval(poll, POLL_INTERVAL_MS);

    function onVisibilityChange() {
      if (!document.hidden) void poll();
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  const activeNotification = queue[0] ?? null;

  return {
    activeNotification,
    dismissNotification,
  };
}
