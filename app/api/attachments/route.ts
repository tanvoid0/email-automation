import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { AttachmentModel } from "@/lib/models/Attachment";
import { attachmentSchema } from "@/lib/validations/attachment";

export const dynamic = "force-dynamic";

// GET all attachments
export async function GET() {
  try {
    await connectDB();
    const attachments = await AttachmentModel.find().sort({ createdAt: -1 });
    return NextResponse.json(attachments);
  } catch (error: any) {
    console.error("Error fetching attachments:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch attachments" },
      { status: 500 }
    );
  }
}

// POST create new attachment
export async function POST(request: NextRequest) {
  try {
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
    const attachment = await AttachmentModel.create(attachmentData);

    return NextResponse.json(attachment, { status: 201 });
  } catch (error: any) {
    console.error("Error creating attachment:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create attachment" },
      { status: 500 }
    );
  }
}

