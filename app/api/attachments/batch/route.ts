import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { AttachmentModel } from "@/lib/models/Attachment";

export const dynamic = "force-dynamic";

// POST get multiple attachments by IDs
export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const body = await request.json();
    const { ids } = body;

    if (!Array.isArray(ids)) {
      return NextResponse.json(
        { error: "ids must be an array" },
        { status: 400 }
      );
    }

    if (ids.length === 0) {
      return NextResponse.json([]);
    }

    // Filter out invalid IDs - only keep valid ObjectId strings
    const validIds = ids.filter((id: any): id is string => {
      if (typeof id === 'string') {
        return /^[0-9a-fA-F]{24}$/.test(id.trim());
      }
      // If it's an object, it's invalid - log it but don't include it
      if (typeof id === 'object' && id !== null) {
        console.warn("[Batch Attachments] Invalid attachment ID (object instead of string):", id);
      }
      return false;
    });

    if (validIds.length === 0) {
      return NextResponse.json([]);
    }

    const attachments = await AttachmentModel.find({
      _id: { $in: validIds }
    });

    return NextResponse.json(attachments);
  } catch (error: any) {
    console.error("Error fetching attachments:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch attachments" },
      { status: 500 }
    );
  }
}

