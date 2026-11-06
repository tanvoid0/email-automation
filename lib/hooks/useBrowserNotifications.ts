"use client";

import { useEffect } from "react";
import { isEnabled, show } from "@/lib/utils/browser-notifications";
import type { NotificationData } from "@/lib/types/notification";

const POLL_MS = 15_000;

/**
 * Mirrors new unread in-app notifications as OS notifications while the window is not focused
 * (when it is, the sonner toast already shows). Mount once (NotificationBell is single-instance).
 * First poll after mount/enable only seeds the seen-set, so old unread items don't fire.
 */
export function useBrowserNotifications() {
  useEffect(() => {
    const seen = new Set<string>();
    let seeded = false;

    const tick = async () => {
      if (!isEnabled()) {
        seeded = false; // re-seed silently if the user turns it back on
        return;
      }
      try {
        const res = await fetch("/api/notifications?read=false&limit=20");
        if (!res.ok) return;
        const { notifications = [] } = (await res.json()) as { notifications?: NotificationData[] };
        const fresh = notifications.filter((n) => n._id && !seen.has(n._id));
        fresh.forEach((n) => seen.add(n._id!));
        const focused = document.visibilityState === "visible" && document.hasFocus();
        if (seeded && !focused) {
          for (const n of fresh) {
            const appId = n.metadata?.applicationId;
            await show(n.title, n.message, { tag: n._id, url: appId ? `/applications/${appId}` : "/" });
          }
        }
        seeded = true;
      } catch (e) {
        console.warn("[BrowserNotifications]", e);
      }
    };

    tick();
    const id = setInterval(tick, POLL_MS);
    return () => clearInterval(id);
  }, []);
}
