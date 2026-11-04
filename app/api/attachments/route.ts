import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { AttachmentModel } from "@/lib/models/Attachment";
import { attachmentSchema } from "@/lib/validations/attachment";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET all attachments
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    const attachments = await AttachmentModel.find({ userId: session.username }).sort({ createdAt: -1 });
    return NextResponse.json(attachments);
  } catch (error: any) {
    console.error("Error fetching attachments:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch attachments" },
      { status: 500 }
    );
  }
}

// POST create new attachment (only if it doesn't already exist)
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    const body = await request.json();

    // Validate with Zod
    const validationResult = attachmentSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validationResult.error.flatten().fieldErrors
        },
        { status: 400 }
      );
    }

    const attachmentData = validationResult.data;

    // Check if attachment already exists for this account (by content - this is the unique identifier)
    // ponytail: inlined instead of lib/utils/attachments#findOrCreateAttachment, which isn't userId-aware yet
    const existing = await AttachmentModel.findOne({
      userId: session.username,
      content: attachmentData.content,
    }).select("_id");

    const attachmentId = existing
      ? existing._id.toString()
      : (
          await AttachmentModel.create({
            ...attachmentData,
            userId: session.username,
            referencedByApplications: [],
            referencedByTemplates: [],
          })
        )._id.toString();

    // Fetch and return the attachment (existing or newly created)
    const attachment = await AttachmentModel.findOne({ _id: attachmentId, userId: session.username });

    if (!attachment) {
      return NextResponse.json(
        { error: "Failed to create or find attachment" },
        { status: 500 }
      );
    }

    return NextResponse.json(attachment, { status: 201 });
  } catch (error: any) {
    console.error("Error creating attachment:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create attachment" },
      { status: 500 }
    );
  }
}

