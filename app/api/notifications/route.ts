import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { NotificationModel } from "@/lib/models/Notification";
import { getSession } from "@/lib/auth";
import { createNotification } from "@/lib/utils/notifications";
import { z } from "zod";

export const dynamic = "force-dynamic";

const createNotificationSchema = z.object({
  type: z.enum(["success", "error", "warning", "info"]),
  title: z.string().min(1),
  message: z.string().min(1),
  metadata: z.any().optional(),
});

// GET: List notifications for current user
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

    const { searchParams } = new URL(request.url);
    const read = searchParams.get("read");
    const type = searchParams.get("type");
    const limit = parseInt(searchParams.get("limit") || "50");
    const skip = parseInt(searchParams.get("skip") || "0");

    const query: any = { userId: session.username };

    if (read !== null) {
      query.read = read === "true";
    }

    if (type && ["success", "error", "warning", "info"].includes(type)) {
      query.type = type;
    }

    const notifications = await NotificationModel.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .lean();

    const total = await NotificationModel.countDocuments(query);

    return NextResponse.json({
      notifications,
      total,
      limit,
      skip,
    });
  } catch (error: any) {
    console.error("[Notifications API] Error fetching notifications:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch notifications" },
      { status: 500 }
    );
  }
}

// POST: Create notification (server-side only, protected)
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validationResult = createNotificationSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: "Validation failed",
          details: validationResult.error.flatten().fieldErrors
        },
        { status: 400 }
      );
    }

    const notification = await createNotification(
      session.username,
      validationResult.data.type,
      validationResult.data.title,
      validationResult.data.message,
      validationResult.data.metadata
    );

    return NextResponse.json(notification, { status: 201 });
  } catch (error: any) {
    console.error("[Notifications API] Error creating notification:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create notification" },
      { status: 500 }
    );
  }
}

