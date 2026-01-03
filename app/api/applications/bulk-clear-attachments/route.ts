import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { ApplicationModel } from "@/lib/models/Application";
import { AttachmentModel } from "@/lib/models/Attachment";

export const dynamic = "force-dynamic";

// POST clear attachments from multiple applications
export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const body = await request.json();

    const { applicationIds } = body;

    // Validate input
    if (!Array.isArray(applicationIds) || applicationIds.length === 0) {
      return NextResponse.json(
        { error: "applicationIds must be a non-empty array" },
        { status: 400 }
      );
    }

    // Update all applications
    const updateResults = await Promise.all(
      applicationIds.map(async (applicationId: string) => {
        const application = await ApplicationModel.findById(applicationId);
        
        if (!application) {
          return { id: applicationId, success: false, error: "Application not found" };
        }

        // Store old attachment IDs for cleanup
        const oldAttachmentIds = application.attachments || [];
        
        // Clear attachments
        application.attachments = [];
        application.markModified('attachments');
        await application.save();

        // Update attachment references (remove references)
        if (oldAttachmentIds.length > 0) {
          const { syncApplicationAttachmentReferences } = await import("@/lib/utils/attachments");
          await syncApplicationAttachmentReferences(
            AttachmentModel,
            applicationId,
            oldAttachmentIds,
            []
          );
        }

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
    console.error("Error bulk clearing attachments:", error);
    return NextResponse.json(
      { error: error.message || "Failed to clear attachments from applications" },
      { status: 500 }
    );
  }
}

