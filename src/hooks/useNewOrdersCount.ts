"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { subscribeNewOrdersCount } from "@/lib/newOrdersCount";

type NewOrdersCountResponse = {
  count: number;
};

const POLL_INTERVAL_MS = 30_000;

export function useNewOrdersCount() {
  const [count, setCount] = useState(0);
  const fetchingRef = useRef(false);

  const refresh = useCallback(async () => {
    if (fetchingRef.current || document.hidden) return;
    fetchingRef.current = true;
    try {
      const data = await api<NewOrdersCountResponse>("/api/orders/new-count");
      setCount(data.count);
    } catch {
      /* ignore transient fetch failures */
    } finally {
      fetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    void refresh();

    const intervalId = window.setInterval(refresh, POLL_INTERVAL_MS);

    function onVisibilityChange() {
      if (!document.hidden) void refresh();
    }

    const unsubscribe = subscribeNewOrdersCount(() => {
      void refresh();
    });

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      unsubscribe();
    };
  }, [refresh]);

  return { count, refresh };
}
