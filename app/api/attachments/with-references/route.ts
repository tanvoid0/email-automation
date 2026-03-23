import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { AttachmentModel } from "@/lib/models/Attachment";
import { WorkspaceApplicationModel } from "@/lib/models/WorkspaceApplication";
import { EmailTemplateModel } from "@/lib/models/EmailTemplate";

export const dynamic = "force-dynamic";

// GET all attachments with their references (applications and templates)
export async function GET() {
  try {
    await connectDB();
    
    // Get all attachments - exclude content field to avoid memory issues with large files
    // Include reference tracking fields
    // Use lean() to get plain objects and allowDiskUse for sorting large datasets
    const attachments = await AttachmentModel.find()
      .select('_id filename contentType size createdAt updatedAt referencedByApplications referencedByTemplates')
      .sort({ createdAt: -1 })
      .lean()
      .allowDiskUse(true);
    
    // Get all applications
    const applications = await WorkspaceApplicationModel.find(
      {},
      "_id name email attachments kind universityName"
    ).lean();
    
    // Get template (there's only one default template)
    const template = await EmailTemplateModel.findOne({ name: "default" }).lean();
    
    // Build a map of attachment ID to applications that reference it
    // Use both the stored references and scan applications for verification
    const attachmentToApplications = new Map<string, Array<{ id: string; name: string; email: string }>>();
    
    // First, use stored references from attachments (more efficient)
    attachments.forEach((att: any) => {
      if (att.referencedByApplications && Array.isArray(att.referencedByApplications) && att.referencedByApplications.length > 0) {
        attachmentToApplications.set(att._id.toString(), []);
      }
    });
    
    // Then, populate with actual application data
    applications.forEach((app: any) => {
      if (app.attachments && Array.isArray(app.attachments)) {
        app.attachments.forEach((attachmentId: string) => {
          const id = attachmentId.toString();
          if (!attachmentToApplications.has(id)) {
            attachmentToApplications.set(id, []);
          }
          attachmentToApplications.get(id)!.push({
            id: app._id.toString(),
            name: app.name,
            email: app.email,
          });
        });
      }
    });
    
    // Check which attachments are referenced by templates
    // Use both stored references and template data for verification
    const templateAttachmentMap = new Map<string, boolean>();
    
    // First, use stored references from attachments
    attachments.forEach((att: any) => {
      if (att.referencedByTemplates && Array.isArray(att.referencedByTemplates) && att.referencedByTemplates.length > 0) {
        templateAttachmentMap.set(att._id.toString(), true);
      }
    });
    
    // Also check template directly for verification
    if (template && template.attachments && Array.isArray(template.attachments)) {
      const templateAttachmentIds = new Set(
        template.attachments.map((id: any) => id.toString())
      );
      
      attachments.forEach((att: any) => {
        if (templateAttachmentIds.has(att._id.toString())) {
          templateAttachmentMap.set(att._id.toString(), true);
        }
      });
    }
    
    // Build response with references
    const attachmentsWithReferences = attachments.map((att: any) => {
      const attachmentId = att._id.toString();
      const linkedApplications = attachmentToApplications.get(attachmentId) || [];
      const isInTemplate = templateAttachmentMap.has(attachmentId);
      
      return {
        _id: att._id,
        filename: att.filename,
        contentType: att.contentType,
        size: att.size,
        createdAt: att.createdAt,
        updatedAt: att.updatedAt,
        linkedApplications,
        isInTemplate,
        referenceCount: linkedApplications.length + (isInTemplate ? 1 : 0),
      };
    });
    
    return NextResponse.json(attachmentsWithReferences);
  } catch (error: any) {
    console.error("Error fetching attachments with references:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch attachments" },
      { status: 500 }
    );
  }
}

