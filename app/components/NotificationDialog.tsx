"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, Check, X, ChevronDown, ChevronUp } from "lucide-react";
import type { NotificationData } from "@/lib/types/notification";
// Using native date formatting instead of date-fns

interface NotificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNotificationUpdate?: () => void;
}

export function NotificationDialog({
  open,
  onOpenChange,
  onNotificationUpdate,
}: NotificationDialogProps) {
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterRead, setFilterRead] = useState<string>("all");
  const [expandedNotifications, setExpandedNotifications] = useState<Set<string>>(new Set());

  const loadNotifications = async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (filterType !== "all") {
        params.append("type", filterType);
      }
      if (filterRead !== "all") {
        params.append("read", filterRead);
      }
      params.append("limit", "100");

      const response = await fetch(`/api/notifications?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
      }
    } catch (error) {
      console.error("Failed to load notifications:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadNotifications();
    }
  }, [open, filterType, filterRead]);

  const handleMarkRead = async (id: string, read: boolean) => {
    try {
      const response = await fetch(`/api/notifications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ read }),
      });

      if (response.ok) {
        setNotifications((prev) =>
          prev.map((n) =>
            n._id === id ? { ...n, read, readAt: read ? new Date().toISOString() : undefined } : n
          )
        );
        onNotificationUpdate?.();
      }
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/notifications/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setNotifications((prev) => prev.filter((n) => n._id !== id));
        onNotificationUpdate?.();
      }
    } catch (error) {
      console.error("Failed to delete notification:", error);
    }
  };

  const handleClearAll = async (action: "read" | "delete") => {
    try {
      const response = await fetch(`/api/notifications/clear-all?action=${action}`, {
        method: "DELETE",
      });

      if (response.ok) {
        if (action === "delete") {
          setNotifications([]);
        } else {
          setNotifications((prev) =>
            prev.map((n) => ({ ...n, read: true, readAt: new Date().toISOString() }))
          );
        }
        onNotificationUpdate?.();
      }
    } catch (error) {
      console.error("Failed to clear notifications:", error);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedNotifications((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "success":
        return "bg-green-500/10 text-green-700 dark:text-green-400";
      case "error":
        return "bg-red-500/10 text-red-700 dark:text-red-400";
      case "warning":
        return "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400";
      default:
        return "bg-blue-500/10 text-blue-700 dark:text-blue-400";
    }
  };

  const formatTimestamp = (date: string | Date | undefined) => {
    if (!date) return "Unknown";
    try {
      // Use a stable format that works the same on server and client
      const then = new Date(date);
      const now = typeof window !== "undefined" ? new Date() : new Date(Date.now());
      const diffMs = now.getTime() - then.getTime();
      const diffSecs = Math.floor(diffMs / 1000);
      const diffMins = Math.floor(diffSecs / 60);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffSecs < 60) return "just now";
      if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? "s" : ""} ago`;
      if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
      if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`;
      // Use ISO date format instead of locale-specific format to avoid hydration mismatch
      return then.toISOString().split("T")[0];
    } catch {
      return "Unknown";
    }
  };

  const renderNotificationContent = (notification: NotificationData) => {
    const metadata = notification.metadata || {};
    const isBulk = metadata.bulkId && metadata.bulkType === "email";
    const isEmail = metadata.applicationId && !isBulk;

    // Email notification with timestamps
    if (isEmail) {
      return (
        <div className="space-y-2">
          <p className="text-sm">{notification.message}</p>
          <div className="text-xs text-muted-foreground space-y-1">
            {metadata.emailAttemptedAt && (
              <div>Attempted: {formatTimestamp(metadata.emailAttemptedAt)}</div>
            )}
            {metadata.emailSucceededAt && (
              <div className="text-green-600 dark:text-green-400">
                Succeeded: {formatTimestamp(metadata.emailSucceededAt)}
              </div>
            )}
            {metadata.emailFailedAt && (
              <div className="text-red-600 dark:text-red-400">
                Failed: {formatTimestamp(metadata.emailFailedAt)}
              </div>
            )}
            {metadata.errorMessage && (
              <div className="text-red-600 dark:text-red-400 mt-1">
                Error: {metadata.errorMessage}
              </div>
            )}
          </div>
        </div>
      );
    }

    // Bulk notification with grouped failures
    if (isBulk) {
      const totalCount = metadata.totalCount || 0;
      const successCount = metadata.successCount || 0;
      const failureCount = metadata.failureCount || 0;
      const groupedFailures = metadata.groupedFailures || [];
      const isExpanded = expandedNotifications.has(notification._id || "");

      return (
        <div className="space-y-2">
          <p className="text-sm">{notification.message}</p>
          <div className="text-xs text-muted-foreground">
            <div>
              Total: {totalCount} | Success: {successCount} | Failed: {failureCount}
            </div>
          </div>
          {groupedFailures.length > 0 && (
            <div className="mt-2">
              <button
                onClick={() => toggleExpand(notification._id || "")}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                {isExpanded ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
                {groupedFailures.length} failure group{groupedFailures.length !== 1 ? "s" : ""}
              </button>
              {isExpanded && (
                <div className="mt-2 space-y-2 pl-4 border-l-2 border-muted">
                  {groupedFailures.map((group: any, idx: number) => (
                    <div key={idx} className="text-xs">
                      <div className="font-medium text-red-600 dark:text-red-400">
                        {group.count} failed: {group.error}
                      </div>
                      {group.applicationNames && group.applicationNames.length > 0 && (
                        <div className="mt-1 text-muted-foreground pl-2">
                          {group.applicationNames.slice(0, 5).join(", ")}
                          {group.applicationNames.length > 5 &&
                            ` and ${group.applicationNames.length - 5} more`}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      );
    }

    // Regular notification
    return <p className="text-sm">{notification.message}</p>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Notifications</DialogTitle>
        </DialogHeader>

        <div className="flex gap-2 mb-4">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="error">Error</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="info">Info</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterRead} onValueChange={setFilterRead}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="false">Unread</SelectItem>
              <SelectItem value="true">Read</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex-1" />

          <Button
            variant="outline"
            size="sm"
            onClick={() => handleClearAll("read")}
          >
            Mark All Read
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleClearAll("delete")}
          >
            Clear All
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading notifications...
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No notifications found
            </div>
          ) : (
            notifications.map((notification) => (
              <div
                key={notification._id}
                className={`p-4 rounded-lg border ${
                  !notification.read
                    ? "bg-primary/5 border-primary/20"
                    : "bg-background"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge
                        variant="outline"
                        className={getTypeColor(notification.type)}
                      >
                        {notification.type}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatTimestamp(notification.createdAt)}
                      </span>
                    </div>
                    <div className="font-medium mb-1">{notification.title}</div>
                    {renderNotificationContent(notification)}
                  </div>
                  <div className="flex items-center gap-1">
                    {!notification.read ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleMarkRead(notification._id!, true)}
                        title="Mark as read"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleMarkRead(notification._id!, false)}
                        title="Mark as unread"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleDelete(notification._id!)}
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

