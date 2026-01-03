import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { NotificationModel } from "@/lib/models/Notification";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

// DELETE: Mark all notifications as read or delete all
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    await connectDB();

    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") || "read"; // "read" or "delete"

    if (action === "delete") {
      const result = await NotificationModel.deleteMany({
        userId: session.username,
      });

      return NextResponse.json({
        success: true,
        deletedCount: result.deletedCount,
      });
    } else {
      // Mark all as read
      const result = await NotificationModel.updateMany(
        {
          userId: session.username,
          read: false,
        },
        {
          $set: {
            read: true,
            readAt: new Date(),
          },
        }
      );

      return NextResponse.json({
        success: true,
        updatedCount: result.modifiedCount,
      });
    }
  } catch (error: any) {
    console.error("[Notifications API] Error clearing notifications:", error);
    return NextResponse.json(
      { error: error.message || "Failed to clear notifications" },
      { status: 500 }
    );
  }
}

