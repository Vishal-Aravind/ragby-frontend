"use client";

// "New orders" bell for the dashboard: how many orders arrived since this
// browser last opened Shop -> Orders. The marker lives in localStorage, so
// every team member (and device) keeps their own count and nothing is
// written to the database.
import { useEffect, useState } from "react";

const EVENT = "zavo:orders-seen";
const POLL_MS = 30000;
const seenKey = (projectId) => `zavo_orders_seen_${projectId}`;

export function getOrdersSeenAt(projectId) {
  try {
    let v = localStorage.getItem(seenKey(projectId));
    if (!v) {
      // First visit on this browser: start counting from now, not from the
      // whole order history.
      v = new Date().toISOString();
      localStorage.setItem(seenKey(projectId), v);
    }
    return v;
  } catch {
    return new Date().toISOString();
  }
}

export function markOrdersSeen(projectId) {
  try {
    localStorage.setItem(seenKey(projectId), new Date().toISOString());
  } catch {}
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENT));
}

/** Count of new orders for the Shop menu badge (0 when not allowed / unknown). */
export function useNewOrderCount(projectId, enabled) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!projectId || !enabled) return undefined;
    let stopped = false;

    const load = async () => {
      if (typeof document !== "undefined" && document.hidden) return;
      try {
        const since = getOrdersSeenAt(projectId);
        const res = await fetch(`/api/orders/new-count?project_id=${projectId}&since=${encodeURIComponent(since)}`);
        if (!res.ok || stopped) return;
        const data = await res.json();
        if (!stopped) setCount(Number(data.count) || 0);
      } catch {}
    };

    load();
    const timer = setInterval(load, POLL_MS);
    const onSeen = () => load();
    window.addEventListener(EVENT, onSeen);
    document.addEventListener("visibilitychange", load);
    return () => {
      stopped = true;
      clearInterval(timer);
      window.removeEventListener(EVENT, onSeen);
      document.removeEventListener("visibilitychange", load);
    };
  }, [projectId, enabled]);

  // "(2) zavo" in the browser tab, so a minimised dashboard still shows it.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const base = document.title.replace(/^\(\d+\)\s*/, "");
    document.title = count > 0 ? `(${count}) ${base}` : base;
  }, [count]);

  return count;
}
