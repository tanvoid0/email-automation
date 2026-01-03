import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { NotificationModel } from "@/lib/models/Notification";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET: Get unread count for current user (optimized for polling)
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    await connectDB();

    const count = await NotificationModel.countDocuments({
      userId: session.username,
      read: false,
    });

    return NextResponse.json({ count });
  } catch (error: any) {
    console.error("[Notifications API] Error fetching unread count:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch unread count" },
      { status: 500 }
    );
  }
}

