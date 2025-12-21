import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { ApplicationModel } from "@/lib/models/Application";
import { AttachmentModel } from "@/lib/models/Attachment";
import { attachmentSchema } from "@/lib/validations/attachment";

export const dynamic = "force-dynamic";

// GET single application
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;
    const application = await ApplicationModel.findById(id);
    
    if (!application) {
      return NextResponse.json(
        { error: "Application not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(application);
  } catch (error: any) {
    console.error("Error fetching application:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch application" },
      { status: 500 }
    );
  }
}

// PATCH update application
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;
    const body = await request.json();

    console.log("[Applications API] PATCH request received:", {
      id,
      hasAttachments: body.attachments !== undefined,
      attachmentsType: typeof body.attachments,
      attachmentsIsArray: Array.isArray(body.attachments),
      attachmentsLength: body.attachments?.length || 0,
    });

    // Find the application first
    const application = await ApplicationModel.findById(id);
    
    if (!application) {
      return NextResponse.json(
        { error: "Application not found" },
        { status: 404 }
      );
    }

    // Update fields
    if (body.name !== undefined) application.name = body.name;
    if (body.university !== undefined) application.university = body.university;
    if (body.email !== undefined) application.email = body.email;
    if (body.emailText !== undefined) application.emailText = body.emailText;
    if (body.status !== undefined) application.status = body.status;
    if (body.error !== undefined) application.error = body.error;
    
    // Handle attachments: if they're objects, create them first and get IDs
    if (body.attachments !== undefined) {
      if (Array.isArray(body.attachments) && body.attachments.length > 0) {
        const firstAttachment = body.attachments[0];
        if (typeof firstAttachment === 'object' && firstAttachment.filename) {
          // Old format: create attachments and get IDs
          const attachmentPromises = body.attachments.map((att: any) => {
            const validationResult = attachmentSchema.safeParse(att);
            if (!validationResult.success) {
              throw new Error(`Invalid attachment: ${validationResult.error.message}`);
            }
            return AttachmentModel.create(validationResult.data);
          });
          const createdAttachments = await Promise.all(attachmentPromises);
          application.attachments = createdAttachments.map(att => att._id.toString());
        } else if (typeof firstAttachment === 'string') {
          // New format: already IDs
          application.attachments = body.attachments;
        }
      } else {
        application.attachments = [];
      }
      application.markModified('attachments');
      console.log("[Applications API] Setting attachments:", {
        count: application.attachments.length,
      });
    }

    // Save the document to ensure Mongoose properly handles nested arrays
    await application.save();
    
    console.log("[Applications API] Application updated:", {
      id: application._id,
      hasAttachments: !!application.attachments,
      attachmentsLength: application.attachments?.length || 0,
    });

    return NextResponse.json(application);
  } catch (error: any) {
    console.error("Error updating application:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update application" },
      { status: 500 }
    );
  }
}

// DELETE application
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;
    const application = await ApplicationModel.findByIdAndDelete(id);

    if (!application) {
      return NextResponse.json(
        { error: "Application not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: "Application deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting application:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete application" },
      { status: 500 }
    );
  }
}

