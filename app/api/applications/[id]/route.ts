import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import {
  WorkspaceApplicationModel,
  WORKSPACE_KIND_EMAIL,
} from "@/lib/models/WorkspaceApplication";
import { AttachmentModel } from "@/lib/models/Attachment";
import { EmailTemplateModel } from "@/lib/models/EmailTemplate";
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
    const application = await WorkspaceApplicationModel.findOne({
      _id: id,
      kind: WORKSPACE_KIND_EMAIL,
    });

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

    const application = await WorkspaceApplicationModel.findOne({
      _id: id,
      kind: WORKSPACE_KIND_EMAIL,
    });

    if (!application) {
      return NextResponse.json(
        { error: "Application not found" },
        { status: 404 }
      );
    }

    // Update fields
    const attemptId: string | undefined = body.attemptId;
    const isStatusUpdate = body.status !== undefined;

    if (body.name !== undefined) application.name = body.name.trim();
    if (body.university !== undefined) application.university = body.university.trim();
    if (body.email !== undefined) application.email = body.email.trim();
    if (body.emailText !== undefined) application.emailText = body.emailText.trim();
    if (isStatusUpdate) {
      const nextStatus = body.status as typeof application.status;

      // Guard against stale attempts when finalizing status
      if ((nextStatus === "sent" || nextStatus === "error") && application.lastAttemptId && attemptId && attemptId !== application.lastAttemptId) {
        return new NextResponse(
          `Stale attempt: attemptId ${attemptId} does not match lastAttemptId ${application.lastAttemptId}`,
          { status: 409 }
        );
      }

      application.status = nextStatus;

      if (nextStatus === "sending") {
        // When moving to sending, clear any old errors and record the active attempt
        application.error = undefined;
        application.errorDetails = undefined;
        application.markModified('errorDetails');
        if (attemptId) {
          application.lastAttemptId = attemptId;
        }
      }

      if (nextStatus === "sent") {
        application.error = undefined;
        application.errorDetails = undefined;
        application.markModified('errorDetails');
      }

      // Increment status version on any status update
      application.statusVersion = (application.statusVersion || 0) + 1;
    }
    if (body.error !== undefined) {
      // Allow explicitly setting error to null to clear it
      application.error = body.error === null ? undefined : body.error;
    }
    if (body.errorDetails !== undefined) {
      // Allow explicitly setting errorDetails to null to clear it
      if (body.errorDetails === null) {
        application.errorDetails = undefined;
      } else {
        application.errorDetails = body.errorDetails;
      }
      application.markModified('errorDetails');
    }
    
    // Store old attachment IDs before update for cleanup
    const oldAttachmentIds = application.attachments ? [...application.attachments] : [];

    // Handle attachments: can be a mix of IDs (strings) and objects (new files)
    // IDs are reused directly, objects are created/found by content
    if (body.attachments !== undefined) {
      if (Array.isArray(body.attachments) && body.attachments.length > 0) {
        const { findOrCreateAttachment } = await import("@/lib/utils/attachments");
        
        // Process each attachment - handle mix of IDs and objects
        const attachmentPromises = body.attachments.map(async (att: any) => {
          if (typeof att === 'string') {
            // Already an ID - validate and use directly (no new creation)
            if (/^[0-9a-fA-F]{24}$/.test(att.trim())) {
              return att.trim();
            }
            return null; // Invalid ID format
          } else if (typeof att === 'object' && att !== null && att.filename) {
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
        
        const resolvedIds = (await Promise.all(attachmentPromises)).filter((id): id is string => id !== null);
        // Remove duplicates
        application.attachments = Array.from(new Set(resolvedIds));
      } else {
        application.attachments = [];
      }
      application.markModified('attachments');
    }

    await application.save();

    // Update attachment references
    const newAttachmentIds = application.attachments || [];
    const { syncApplicationAttachmentReferences, cleanupDanglingAttachments } = await import("@/lib/utils/attachments");
    await syncApplicationAttachmentReferences(AttachmentModel, id, oldAttachmentIds, newAttachmentIds);

    // Clean up dangling attachments after update (if attachments were removed)
    if (oldAttachmentIds.length > 0) {
      await cleanupDanglingAttachments(AttachmentModel, WorkspaceApplicationModel, EmailTemplateModel);
    }
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
    const application = await WorkspaceApplicationModel.findOne({
      _id: id,
      kind: WORKSPACE_KIND_EMAIL,
    });

    if (!application) {
      return NextResponse.json(
        { error: "Application not found" },
        { status: 404 }
      );
    }

    // Store attachment IDs before deletion for cleanup
    const attachmentIds = application.attachments || [];

    // Remove references from attachments before deleting application
    if (attachmentIds.length > 0) {
      const { removeApplicationReference } = await import("@/lib/utils/attachments");
      for (const attachmentId of attachmentIds) {
        await removeApplicationReference(AttachmentModel, attachmentId, id);
      }
    }

    // Delete the application
    await WorkspaceApplicationModel.findOneAndDelete({
      _id: id,
      kind: WORKSPACE_KIND_EMAIL,
    });

    // Clean up dangling attachments (attachments not referenced by any other application or template)
    if (attachmentIds.length > 0) {
      const { cleanupDanglingAttachments } = await import("@/lib/utils/attachments");
      await cleanupDanglingAttachments(AttachmentModel, WorkspaceApplicationModel, EmailTemplateModel);
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
