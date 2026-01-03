"use client";

import { useState, useEffect } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NotificationDialog } from "./NotificationDialog";

export function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  // Poll unread count every 8 seconds
  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        const response = await fetch("/api/notifications/unread-count");
        if (response.ok) {
          const data = await response.json();
          setUnreadCount(data.count || 0);
        }
      } catch (error) {
        console.error("Failed to fetch unread count:", error);
      }
    };

    // Fetch immediately
    fetchUnreadCount();

    // Then poll every 8 seconds
    const interval = setInterval(fetchUnreadCount, 8000);

    return () => clearInterval(interval);
  }, []);

  // Refresh count when dialog opens/closes
  useEffect(() => {
    if (isOpen) {
      const fetchUnreadCount = async () => {
        try {
          const response = await fetch("/api/notifications/unread-count");
          if (response.ok) {
            const data = await response.json();
            setUnreadCount(data.count || 0);
          }
        } catch (error) {
          console.error("Failed to fetch unread count:", error);
        }
      };
      fetchUnreadCount();
    }
  }, [isOpen]);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={() => setIsOpen(true)}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <Badge
            variant="destructive"
            className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </Badge>
        )}
      </Button>
      <NotificationDialog
        open={isOpen}
        onOpenChange={setIsOpen}
        onNotificationUpdate={() => {
          // Refresh count when notification is updated
          fetch("/api/notifications/unread-count")
            .then((res) => res.json())
            .then((data) => setUnreadCount(data.count || 0))
            .catch(console.error);
        }}
      />
    </>
  );
}

