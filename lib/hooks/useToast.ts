"use client";

import { useCallback } from "react";
import { toast as sonnerToast } from "sonner";
import type { NotificationType, NotificationMetadata } from "@/lib/types/notification";

interface ToastOptions {
  /**
   * Whether to create a persistent notification in the database.
   * Default: true for error/warning, false for success/info
   */
  persist?: boolean;
  /**
   * Title for the notification (defaults to message)
   */
  title?: string;
  /**
   * Metadata to attach to the notification
   */
  metadata?: NotificationMetadata;
  /**
   * Duration in milliseconds (sonner option)
   */
  duration?: number;
  /**
   * Additional sonner toast options
   */
  [key: string]: any;
}

/**
 * Unified toast/notification hook.
 * Automatically creates persistent notifications for important messages.
 */
export function useToast() {
  const createNotificationIfNeeded = useCallback(
    async (type: NotificationType, message: string, options?: ToastOptions) => {
      // Only create notifications if persist is true (or default for errors/warnings)
      const shouldPersist = options?.persist ?? (type === "error" || type === "warning");

      if (!shouldPersist) {
        return;
      }

      try {
        const response = await fetch("/api/notifications", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type,
            title: options?.title || message,
            message,
            metadata: options?.metadata || {},
          }),
        });

        if (!response.ok) {
          console.warn("[Toast] Failed to create notification:", response.statusText);
        }
      } catch (error) {
        // Silently fail - don't break toast functionality if notification creation fails
        console.warn("[Toast] Error creating notification:", error);
      }
    },
    []
  );

  const toast = {
    success: useCallback(
      async (message: string, options?: ToastOptions) => {
        await createNotificationIfNeeded("success", message, options);
        return sonnerToast.success(message, {
          id: options?.id || `success-${message}`,
          ...options,
        });
      },
      [createNotificationIfNeeded]
    ),
    error: useCallback(
      async (message: string, options?: ToastOptions) => {
        await createNotificationIfNeeded("error", message, options);
        return sonnerToast.error(message, {
          id: options?.id || `error-${message}`,
          ...options,
        });
      },
      [createNotificationIfNeeded]
    ),
    warning: useCallback(
      async (message: string, options?: ToastOptions) => {
        await createNotificationIfNeeded("warning", message, options);
        return sonnerToast.warning(message, {
          id: options?.id || `warning-${message}`,
          ...options,
        });
      },
      [createNotificationIfNeeded]
    ),
    info: useCallback(
      async (message: string, options?: ToastOptions) => {
        await createNotificationIfNeeded("info", message, options);
        return sonnerToast.info(message, {
          id: options?.id || `info-${message}`,
          ...options,
        });
      },
      [createNotificationIfNeeded]
    ),
    // Pass through other sonner methods
    promise: sonnerToast.promise,
    loading: sonnerToast.loading,
    custom: sonnerToast.custom,
    dismiss: sonnerToast.dismiss,
    message: sonnerToast.message,
  };

  return toast;
}

