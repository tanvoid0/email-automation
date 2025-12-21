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
    
    // Parse request body with error handling
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      const err = parseError as Error;
      console.error("[Applications API] Failed to parse request body:", err);
      return NextResponse.json(
        { error: "Invalid request body. Please ensure all required fields are provided." },
        { status: 400 }
      );
    }

    // Validate that body exists and has required fields
    if (!body || typeof body !== 'object') {
      console.error("[Applications API] Invalid body:", body);
      return NextResponse.json(
        { error: "Request body is required" },
        { status: 400 }
      );
    }

    // Log all received fields for debugging
    console.log("[Applications API] POST request received:", {
      hasName: !!body.name,
      hasUniversity: !!body.university,
      hasEmail: !!body.email,
      hasEmailText: !!body.emailText,
      emailTextLength: body.emailText?.length || 0,
      hasAttachments: body.attachments !== undefined,
      attachmentsType: typeof body.attachments,
      attachmentsIsArray: Array.isArray(body.attachments),
      attachmentsLength: body.attachments?.length || 0,
      bodyKeys: Object.keys(body),
    });

    // Early validation - check required fields before processing
    if (!body.name || !body.university || !body.email || !body.emailText) {
      return NextResponse.json(
        { 
          error: "Missing required fields",
          details: {
            name: !body.name ? "Name is required" : undefined,
            university: !body.university ? "University is required" : undefined,
            email: !body.email ? "Email is required" : undefined,
            emailText: !body.emailText ? "Email text is required" : undefined,
          }
        },
        { status: 400 }
      );
    }

    // Handle attachments: if they're objects, create them first and get IDs
    let attachmentIds: string[] = [];
    if (body.attachments && Array.isArray(body.attachments) && body.attachments.length > 0) {
      // Check if attachments are objects (old format) or IDs (new format)
      const firstAttachment = body.attachments[0];
      if (typeof firstAttachment === 'object' && firstAttachment.filename) {
        // Old format: create attachments and get IDs
        const attachmentPromises = body.attachments.map((att: { filename: string; content: string; contentType?: string }) => {
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
    // Explicitly preserve all required fields to avoid any spread operator issues
    const applicationBody = {
      name: body.name,
      university: body.university,
      email: body.email,
      emailText: body.emailText,
      attachments: attachmentIds,
      // Preserve status if provided (for updates)
      ...(body.status && { status: body.status }),
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
    
    // Comprehensive logging before Mongoose
    console.log("[Applications API] Validated data from Zod:", {
      hasName: !!applicationData.name,
      nameType: typeof applicationData.name,
      nameValue: applicationData.name?.substring(0, 30),
      hasUniversity: !!applicationData.university,
      universityType: typeof applicationData.university,
      universityValue: applicationData.university?.substring(0, 30),
      hasEmail: !!applicationData.email,
      emailType: typeof applicationData.email,
      emailValue: applicationData.email,
      hasEmailText: !!applicationData.emailText,
      emailTextType: typeof applicationData.emailText,
      emailTextLength: applicationData.emailText?.length || 0,
      hasAttachments: applicationData.attachments !== undefined,
      attachmentsType: typeof applicationData.attachments,
      attachmentsIsArray: Array.isArray(applicationData.attachments),
      attachmentsLength: applicationData.attachments?.length || 0,
      allKeys: Object.keys(applicationData),
      fullData: JSON.stringify({
        name: applicationData.name,
        university: applicationData.university,
        email: applicationData.email,
        emailText: applicationData.emailText?.substring(0, 100),
        attachments: applicationData.attachments,
      }),
    });

    // Ensure all required fields are present and not undefined
    if (!applicationData.name || !applicationData.university || !applicationData.email || !applicationData.emailText) {
      console.error("[Applications API] Missing fields after Zod validation:", {
        name: applicationData.name,
        university: applicationData.university,
        email: applicationData.email,
        emailText: applicationData.emailText,
      });
      return NextResponse.json(
        { 
          error: "Validation failed: Missing required fields after validation",
          details: {
            name: !applicationData.name ? "Name is missing" : undefined,
            university: !applicationData.university ? "University is missing" : undefined,
            email: !applicationData.email ? "Email is missing" : undefined,
            emailText: !applicationData.emailText ? "Email text is missing" : undefined,
          }
        },
        { status: 400 }
      );
    }

    // Create a clean object for Mongoose with explicit field assignment
    const mongooseData = {
      name: String(applicationData.name),
      university: String(applicationData.university),
      email: String(applicationData.email),
      emailText: String(applicationData.emailText),
      attachments: Array.isArray(applicationData.attachments) ? applicationData.attachments : [],
      status: (body.status as "pending" | "sending" | "sent" | "error") || "pending",
    };

    console.log("[Applications API] Data for Mongoose:", {
      name: mongooseData.name.substring(0, 30),
      university: mongooseData.university.substring(0, 30),
      email: mongooseData.email,
      emailTextLength: mongooseData.emailText.length,
      attachmentsCount: mongooseData.attachments.length,
    });

    const application = await ApplicationModel.create(mongooseData);

    console.log("[Applications API] Application created:", {
      id: application._id,
      hasAttachments: !!application.attachments,
      attachmentsLength: application.attachments?.length || 0,
    });

    return NextResponse.json(application, { status: 201 });
  } catch (error) {
    const err = error as Error & { code?: number; errors?: Record<string, { message: string }> };
    console.error("Error creating application:", err);
    console.error("Error details:", {
      name: err.name,
      message: err.message,
      code: err.code,
      errors: err.errors,
    });
    
    // Handle Mongoose validation errors
    if (err.name === 'ValidationError' && err.errors) {
      const validationErrors: Record<string, string> = {};
      Object.keys(err.errors).forEach((key) => {
        validationErrors[key] = err.errors![key].message;
      });
      return NextResponse.json(
        { 
          error: "Validation failed",
          details: validationErrors
        },
        { status: 400 }
      );
    }
    
    // Handle duplicate email error
    if (err.code === 11000) {
      return NextResponse.json(
        { error: "An application with this email already exists" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: err.message || "Failed to create application" },
      { status: 500 }
    );
  }
}

