"use client";

// Client-only helpers for OS-level browser notifications.
// Shown via the service worker (public/sw.js): `new Notification()` throws on Android Chrome.
// Needs a secure context (https or localhost); `supported()` is false otherwise.

const KEY = "browserNotifications";

export const supported = () =>
  typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator;

export const permission = (): NotificationPermission | "unsupported" =>
  supported() ? Notification.permission : "unsupported";

/** Opt-in is per browser (localStorage) and needs the browser permission too. */
export const isEnabled = () =>
  supported() && Notification.permission === "granted" && localStorage.getItem(KEY) === "on";

/** Must be called from a user gesture (click) or the browser ignores the permission prompt. */
export async function enable(): Promise<NotificationPermission> {
  const result = await Notification.requestPermission();
  if (result === "granted") {
    localStorage.setItem(KEY, "on");
    await navigator.serviceWorker.register("/sw.js");
  }
  return result;
}

export const disable = () => localStorage.removeItem(KEY);

export async function show(title: string, body: string, opts: { url?: string; tag?: string } = {}) {
  await navigator.serviceWorker.register("/sw.js"); // idempotent
  const reg = await navigator.serviceWorker.ready;
  // same tag = replaced, so several open tabs don't stack duplicates
  await reg.showNotification(title, { body, tag: opts.tag, data: { url: opts.url ?? "/" } });
}
