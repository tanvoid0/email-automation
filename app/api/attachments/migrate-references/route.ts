import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { AttachmentModel } from "@/lib/models/Attachment";
import { ApplicationModel } from "@/lib/models/Application";
import { EmailTemplateModel } from "@/lib/models/EmailTemplate";

export const dynamic = "force-dynamic";

// POST migrate and fix attachment references
// This will:
// 1. Convert template embedded attachments to IDs
// 2. Populate attachment reference fields
// 3. Ensure bidirectional consistency
export async function POST() {
  try {
    await connectDB();
    
    let migratedTemplates = 0;
    let populatedReferences = 0;
    let fixedInconsistencies = 0;
    
    // Step 1: Migrate template attachments from embedded objects to IDs
    const templates = await EmailTemplateModel.find().lean();
    for (const template of templates) {
      if (template.attachments && Array.isArray(template.attachments)) {
        const firstAttachment = template.attachments[0];
        
        // Check if it's still in old format (embedded objects)
        const firstAtt = firstAttachment as any;
        if (firstAtt && typeof firstAtt === 'object' && firstAtt.filename && firstAtt.content) {
          const { findOrCreateAttachment } = await import("@/lib/utils/attachments");
          const attachmentIds: string[] = [];
          
          for (const att of template.attachments) {
            const attObj = att as any;
            if (typeof attObj === 'object' && attObj.filename && attObj.content) {
              const id = await findOrCreateAttachment(AttachmentModel, {
                filename: attObj.filename,
                content: attObj.content,
                contentType: attObj.contentType,
                size: attObj.size,
              });
              attachmentIds.push(id);
            }
          }
          
          // Update template with IDs
          await EmailTemplateModel.updateOne(
            { _id: template._id },
            { $set: { attachments: attachmentIds } }
          );
          
          // Update attachment references
          const { syncTemplateAttachmentReferences } = await import("@/lib/utils/attachments");
          await syncTemplateAttachmentReferences(AttachmentModel, template.name, [], attachmentIds);
          
          migratedTemplates++;
        }
      }
    }
    
    // Step 2: Populate attachment reference fields from applications
    const applications = await ApplicationModel.find({}, '_id attachments').lean();
    for (const app of applications) {
      if (app.attachments && Array.isArray(app.attachments) && app.attachments.length > 0) {
        const { syncApplicationAttachmentReferences } = await import("@/lib/utils/attachments");
        // Get current references (might be empty)
        const attachment = await AttachmentModel.findById(app.attachments[0]);
        const currentRefs = attachment?.referencedByApplications || [];
        const hasRef = currentRefs.includes(app._id.toString());
        
        if (!hasRef) {
          await syncApplicationAttachmentReferences(AttachmentModel, app._id.toString(), [], app.attachments);
          populatedReferences++;
        }
      }
    }
    
    // Step 3: Verify and fix inconsistencies
    const allAttachments = await AttachmentModel.find({}, '_id referencedByApplications referencedByTemplates').lean();
    for (const att of allAttachments) {
      const attachmentId = att._id.toString();
      const storedAppRefs = (att.referencedByApplications || []).map((id: any) => id.toString());
      const storedTemplateRefs = (att.referencedByTemplates || []).map((id: any) => id.toString());
      
      // Check applications
      const appsWithThisAttachment = await ApplicationModel.find({
        attachments: attachmentId
      }, '_id').lean();
      const actualAppRefs = appsWithThisAttachment.map((app: any) => app._id.toString());
      
      // Check templates
      const templatesWithThisAttachment = await EmailTemplateModel.find({
        attachments: attachmentId
      }, 'name').lean();
      const actualTemplateRefs = templatesWithThisAttachment.map((t: any) => t.name);
      
      // Fix if inconsistent
      const appRefsMatch = JSON.stringify([...storedAppRefs].sort()) === JSON.stringify([...actualAppRefs].sort());
      const templateRefsMatch = JSON.stringify([...storedTemplateRefs].sort()) === JSON.stringify([...actualTemplateRefs].sort());
      
      if (!appRefsMatch || !templateRefsMatch) {
        await AttachmentModel.updateOne(
          { _id: att._id },
          {
            $set: {
              referencedByApplications: actualAppRefs,
              referencedByTemplates: actualTemplateRefs,
            }
          }
        );
        fixedInconsistencies++;
      }
    }
    
    return NextResponse.json({
      message: "Migration completed",
      migratedTemplates,
      populatedReferences,
      fixedInconsistencies,
    });
  } catch (error: any) {
    console.error("Error migrating references:", error);
    return NextResponse.json(
      { error: error.message || "Failed to migrate references" },
      { status: 500 }
    );
  }
}

