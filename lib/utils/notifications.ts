import { NotificationModel } from "@/lib/models/Notification";
import type { CreateNotificationInput, NotificationMetadata } from "@/lib/types/notification";
import connectDB from "@/lib/mongodb";

/**
 * Server-side helper to create a notification in the database
 */
export async function createNotification(
  userId: string,
  type: CreateNotificationInput["type"],
  title: string,
  message: string,
  metadata?: NotificationMetadata
) {
  try {
    await connectDB();
    
    const notification = await NotificationModel.create({
      userId,
      type,
      title,
      message,
      metadata: metadata || {},
      read: false,
    });

    return notification;
  } catch (error) {
    console.error("[Notification] Error creating notification:", error);
    throw error;
  }
}

/**
 * Server-side helper to update a notification
 */
export async function updateNotification(
  notificationId: string,
  updates: {
    read?: boolean;
    readAt?: Date;
    metadata?: NotificationMetadata;
    message?: string;
    type?: CreateNotificationInput["type"];
  }
) {
  try {
    await connectDB();
    
    const updateData: any = { ...updates };
    if (updates.read && !updates.readAt) {
      updateData.readAt = new Date();
    }
    if (updates.read === false) {
      updateData.readAt = undefined;
    }

    const notification = await NotificationModel.findByIdAndUpdate(
      notificationId,
      updateData,
      { new: true }
    );

    return notification;
  } catch (error) {
    console.error("[Notification] Error updating notification:", error);
    throw error;
  }
}

/**
 * Client-side helper to create a notification via API
 */
export async function createNotificationFromToast(
  type: CreateNotificationInput["type"],
  title: string,
  message: string,
  metadata?: NotificationMetadata
) {
  try {
    const response = await fetch("/api/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type,
        title,
        message,
        metadata: metadata || {},
      }),
    });

    if (!response.ok) {
      console.error("[Notification] Failed to create notification via API");
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error("[Notification] Error creating notification via API:", error);
    return null;
  }
}

// Note: groupFailuresByError has been moved to lib/utils/notification-helpers.ts
// to avoid importing server-side dependencies in client components

