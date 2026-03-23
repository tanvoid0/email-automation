import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import {
  WorkspaceApplicationModel,
  WORKSPACE_KIND_EMAIL,
} from "@/lib/models/WorkspaceApplication";
import { AttachmentModel } from "@/lib/models/Attachment";
import { applicationSchema } from "@/lib/validations/application";
import { attachmentSchema } from "@/lib/validations/attachment";
import { getErrorMessage } from "@/lib/types/errors";
import type { ApiErrorResponse } from "@/lib/types/api";

export const dynamic = "force-dynamic";

// GET all applications
export async function GET() {
  try {
    await connectDB();
    const applications = await WorkspaceApplicationModel.find({
      kind: WORKSPACE_KIND_EMAIL,
    }).sort({ createdAt: -1 });
    return NextResponse.json(applications);
  } catch (error: unknown) {
    const errorMessage = getErrorMessage(error);
    console.error("Error fetching applications:", errorMessage);
    const errorResponse: ApiErrorResponse = {
      error: errorMessage || "Failed to fetch applications",
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

// POST create new application
export async function POST(request: NextRequest) {
  try {
    await connectDB();
    
    const body = await request.json();

    // Validate with Zod
    const validationResult = applicationSchema.safeParse({
      name: body.name,
      university: body.university,
      email: body.email,
      emailText: body.emailText,
      attachments: [], // Will be populated after attachment creation
    });

    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: "Validation failed",
          details: validationResult.error.flatten().fieldErrors
        },
        { status: 400 }
      );
    }

    // Handle attachments: can be a mix of IDs (strings) and objects (new files)
    // IDs are reused directly, objects are created/found by content
    let attachmentIds: string[] = [];
    if (body.attachments && Array.isArray(body.attachments) && body.attachments.length > 0) {
      const { findOrCreateAttachment } = await import("@/lib/utils/attachments");
      
      // Process each attachment - handle mix of IDs and objects
      const attachmentPromises = body.attachments.map(async (att: unknown) => {
        if (typeof att === 'string') {
          // Already an ID - validate and use directly (no new creation)
          if (/^[0-9a-fA-F]{24}$/.test(att.trim())) {
            return att.trim();
          }
          return null; // Invalid ID format
        } else if (typeof att === 'object' && att !== null && 'filename' in att) {
          // New file object - find or create (deduplicate by content)
          const validationResult = attachmentSchema.safeParse(att);
          if (!validationResult.success) {
            throw new Error(`Invalid attachment: ${validationResult.error.message}`);
          }
          // Use findOrCreateAttachment to avoid duplicates
          return await findOrCreateAttachment(AttachmentModel, validationResult.data);
        }
        return null; // Invalid format
      });
      
      attachmentIds = (await Promise.all(attachmentPromises)).filter((id): id is string => id !== null);
      // Remove duplicates
      attachmentIds = Array.from(new Set(attachmentIds));
    }

    // Create application
    const application = await WorkspaceApplicationModel.create({
      kind: WORKSPACE_KIND_EMAIL,
      name: body.name.trim(),
      university: body.university.trim(),
      email: body.email.trim(),
      emailText: body.emailText.trim(),
      attachments: attachmentIds,
      status: body.status || "pending",
    });

    // Update attachment references
    if (attachmentIds.length > 0) {
      const { syncApplicationAttachmentReferences } = await import("@/lib/utils/attachments");
      await syncApplicationAttachmentReferences(AttachmentModel, application._id.toString(), [], attachmentIds);
    }

    return NextResponse.json(application, { status: 201 });
  } catch (error: unknown) {
    console.error("Error creating application:", error);
    
    // Handle MongoDB duplicate key error (E11000) - if unique index still exists, provide helpful message
    if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
      const errorResponse: ApiErrorResponse = {
        error: "A unique index on the email field still exists in the database. Please drop the conflicting index from the 'workspace_applications' collection to allow duplicate emails.",
      };
      return NextResponse.json(errorResponse, { status: 500 });
    }
    
    // Handle Mongoose validation errors
    if (error && typeof error === 'object' && 'name' in error && error.name === 'ValidationError' && 'errors' in error) {
      const validationErrors: Record<string, string> = {};
      const mongooseError = error as { errors: Record<string, { message: string }> };
      Object.keys(mongooseError.errors).forEach((key) => {
        validationErrors[key] = mongooseError.errors[key].message;
      });
      return NextResponse.json(
        { 
          error: "Validation failed",
          details: validationErrors
        },
        { status: 400 }
      );
    }
    
    const errorMessage = getErrorMessage(error);
    const errorResponse: ApiErrorResponse = {
      error: errorMessage || "Failed to create application",
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
