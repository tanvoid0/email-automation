import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { ApplicationModel } from "@/lib/models/Application";
import { AttachmentModel } from "@/lib/models/Attachment";
import { applicationSchema } from "@/lib/validations/application";
import { attachmentSchema } from "@/lib/validations/attachment";

export const dynamic = "force-dynamic";

// GET all applications
export async function GET() {
  try {
    await connectDB();
    const applications = await ApplicationModel.find().sort({ createdAt: -1 });
    return NextResponse.json(applications);
  } catch (error: any) {
    console.error("Error fetching applications:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch applications" },
      { status: 500 }
    );
  }
}

// POST create new application
export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const body = await request.json();

    console.log("[Applications API] POST request received:", {
      hasAttachments: body.attachments !== undefined,
      attachmentsType: typeof body.attachments,
      attachmentsIsArray: Array.isArray(body.attachments),
      attachmentsLength: body.attachments?.length || 0,
    });

    // Handle attachments: if they're objects, create them first and get IDs
    let attachmentIds: string[] = [];
    if (body.attachments && Array.isArray(body.attachments) && body.attachments.length > 0) {
      // Check if attachments are objects (old format) or IDs (new format)
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
        attachmentIds = createdAttachments.map(att => att._id.toString());
      } else if (typeof firstAttachment === 'string') {
        // New format: already IDs
        attachmentIds = body.attachments;
      }
    }

    // Prepare application data with attachment IDs
    const applicationBody = {
      ...body,
      attachments: attachmentIds,
    };

    // Validate with Zod
    const validationResult = applicationSchema.safeParse(applicationBody);
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: "Validation failed",
          details: validationResult.error.flatten().fieldErrors
        },
        { status: 400 }
      );
    }

    const applicationData = validationResult.data;
    console.log("[Applications API] Validated data:", {
      hasAttachments: applicationData.attachments !== undefined,
      attachmentsLength: applicationData.attachments?.length || 0,
    });

    const application = await ApplicationModel.create(applicationData);

    console.log("[Applications API] Application created:", {
      id: application._id,
      hasAttachments: !!application.attachments,
      attachmentsLength: application.attachments?.length || 0,
    });

    return NextResponse.json(application, { status: 201 });
  } catch (error: any) {
    console.error("Error creating application:", error);
    
    // Handle duplicate email error
    if (error.code === 11000) {
      return NextResponse.json(
        { error: "An application with this email already exists" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || "Failed to create application" },
      { status: 500 }
    );
  }
}

