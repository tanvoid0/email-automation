import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import {
  WorkspaceApplicationModel,
  WORKSPACE_KIND_EMAIL,
} from "@/lib/models/WorkspaceApplication";
import { AttachmentModel } from "@/lib/models/Attachment";

export const dynamic = "force-dynamic";

// POST add attachments to multiple applications
export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const body = await request.json();

    const { applicationIds, attachmentIds } = body;

    // Validate input
    if (!Array.isArray(applicationIds) || applicationIds.length === 0) {
      return NextResponse.json(
        { error: "applicationIds must be a non-empty array" },
        { status: 400 }
      );
    }

    if (!Array.isArray(attachmentIds) || attachmentIds.length === 0) {
      return NextResponse.json(
        { error: "attachmentIds must be a non-empty array" },
        { status: 400 }
      );
    }

    // Validate attachment IDs format
    const validAttachmentIds = attachmentIds.filter((id: any): id is string => 
      typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id.trim())
    );

    if (validAttachmentIds.length === 0) {
      return NextResponse.json(
        { error: "No valid attachment IDs provided" },
        { status: 400 }
      );
    }

    // Verify all attachments exist
    const attachments = await AttachmentModel.find({
      _id: { $in: validAttachmentIds }
    });

    if (attachments.length !== validAttachmentIds.length) {
      return NextResponse.json(
        { error: "Some attachment IDs are invalid" },
        { status: 400 }
      );
    }

    // Update all applications
    const updateResults = await Promise.all(
      applicationIds.map(async (applicationId: string) => {
        const application = await WorkspaceApplicationModel.findOne({
          _id: applicationId,
          kind: WORKSPACE_KIND_EMAIL,
        });
        
        if (!application) {
          return { id: applicationId, success: false, error: "Application not found" };
        }

        // Get current attachments
        const currentAttachments = application.attachments || [];
        
        // Add new attachments (avoid duplicates)
        const newAttachments = [...new Set([...currentAttachments, ...validAttachmentIds])];
        
        // Store old attachment IDs for cleanup
        const oldAttachmentIds = [...currentAttachments];

        // Update application
        application.attachments = newAttachments;
        application.markModified('attachments');
        await application.save();

        // Update attachment references
        const { syncApplicationAttachmentReferences } = await import("@/lib/utils/attachments");
        await syncApplicationAttachmentReferences(
          AttachmentModel,
          applicationId,
          oldAttachmentIds,
          newAttachments
        );

        return { id: applicationId, success: true };
      })
    );

    const successCount = updateResults.filter(r => r.success).length;
    const failedCount = updateResults.filter(r => !r.success).length;

    return NextResponse.json({
      success: true,
      updated: successCount,
      failed: failedCount,
      results: updateResults,
    });
  } catch (error: any) {
    console.error("Error bulk attaching to applications:", error);
    return NextResponse.json(
      { error: error.message || "Failed to attach files to applications" },
      { status: 500 }
    );
  }
}

