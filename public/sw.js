// Only job: focus/open the app when a browser notification is clicked.
// Notifications are shown from the page (lib/utils/browser-notifications.ts) via registration.showNotification.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      const win = wins[0];
      if (win) return win.navigate(url).then((c) => (c || win).focus());
      return self.clients.openWindow(url);
    })
  );
});
