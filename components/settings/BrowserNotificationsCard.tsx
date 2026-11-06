"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { disable, enable, isEnabled, permission, show } from "@/lib/utils/browser-notifications";

export function BrowserNotificationsCard() {
  const [perm, setPerm] = useState<ReturnType<typeof permission>>("unsupported");
  const [on, setOn] = useState(false);

  // read browser state after mount (SSR has no Notification API)
  useEffect(() => {
    setPerm(permission());
    setOn(isEnabled());
  }, []);

  const toggle = async () => {
    if (on) {
      disable();
      setOn(false);
      return;
    }
    const result = await enable();
    setPerm(result);
    setOn(result === "granted");
    if (result === "granted") await show("Notifications on", "You'll be alerted here when this tab is in the background.");
  };

  const hint =
    perm === "unsupported"
      ? "This browser, or this connection (needs https), doesn't support notifications."
      : perm === "denied"
        ? "Blocked for this site. Allow notifications in your browser's site settings, then reload."
        : "Get an alert when an email batch finishes or fails while this tab is in the background. Works while the app is open in a tab or installed app.";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          {on ? <Bell className="h-5 w-5 text-primary" /> : <BellOff className="h-5 w-5 text-muted-foreground" />}
          <CardTitle>Browser notifications</CardTitle>
        </div>
        <CardDescription>{hint}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button type="button" variant={on ? "outline" : "default"} onClick={toggle} disabled={perm === "unsupported" || perm === "denied"}>
          {on ? "Turn off on this device" : "Turn on for this device"}
        </Button>
      </CardContent>
    </Card>
  );
}
