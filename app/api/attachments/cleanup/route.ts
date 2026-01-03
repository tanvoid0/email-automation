import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { AttachmentModel } from "@/lib/models/Attachment";
import { ApplicationModel } from "@/lib/models/Application";
import { EmailTemplateModel } from "@/lib/models/EmailTemplate";
import { cleanupDanglingAttachments, cleanupInvalidAttachmentReferences } from "@/lib/utils/attachments";

export const dynamic = "force-dynamic";

// POST cleanup dangling attachments and invalid references
export async function POST(request: NextRequest) {
  try {
    await connectDB();
    
    const body = await request.json().catch(() => ({}));
    const { cleanupReferences = true, cleanupDangling = true } = body;
    
    const results: any = {};
    
    // Clean up invalid attachment references (remove invalid IDs from applications/templates)
    if (cleanupReferences) {
      const refResult = await cleanupInvalidAttachmentReferences(
        AttachmentModel, 
        ApplicationModel, 
        EmailTemplateModel
      );
      results.references = refResult;
    }
    
    // Clean up dangling attachments (delete attachments not referenced by anything)
    if (cleanupDangling) {
      const danglingResult = await cleanupDanglingAttachments(
        AttachmentModel, 
        ApplicationModel, 
        EmailTemplateModel
      );
      results.dangling = danglingResult;
    }
    
    return NextResponse.json({
      message: "Cleanup completed",
      ...results,
    });
  } catch (error: any) {
    console.error("Error cleaning up attachments:", error);
    return NextResponse.json(
      { error: error.message || "Failed to cleanup attachments" },
      { status: 500 }
    );
  }
}

