import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { NotificationModel } from "@/lib/models/Notification";
import { getSession } from "@/lib/auth";
import { updateNotification } from "@/lib/utils/notifications";

export const dynamic = "force-dynamic";

// PATCH: Mark notification as read/unread
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { read, metadata, message, type } = body;

    await connectDB();

    // Verify notification belongs to user
    const notification = await NotificationModel.findOne({
      _id: id,
      userId: session.username,
    });

    if (!notification) {
      return NextResponse.json(
        { error: "Notification not found" },
        { status: 404 }
      );
    }

    const updates: any = {};
    if (read !== undefined) {
      updates.read = read;
    }
    if (metadata !== undefined) {
      updates.metadata = { ...notification.metadata, ...metadata };
    }
    if (message !== undefined) {
      updates.message = message;
    }
    if (type !== undefined) {
      updates.type = type;
    }

    const updated = await updateNotification(id, updates);

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("[Notifications API] Error updating notification:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update notification" },
      { status: 500 }
    );
  }
}

// DELETE: Delete single notification
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await params;

    await connectDB();

    // Verify notification belongs to user and delete
    const notification = await NotificationModel.findOneAndDelete({
      _id: id,
      userId: session.username,
    });

    if (!notification) {
      return NextResponse.json(
        { error: "Notification not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[Notifications API] Error deleting notification:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete notification" },
      { status: 500 }
    );
  }
}

