import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { AttachmentModel } from "@/lib/models/Attachment";
import { WorkspaceApplicationModel } from "@/lib/models/WorkspaceApplication";
import { EmailTemplateModel } from "@/lib/models/EmailTemplate";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

// POST migrate and fix attachment references
// This will:
// 1. Convert template embedded attachments to IDs
// 2. Populate attachment reference fields
// 3. Ensure bidirectional consistency
export async function POST() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    let migratedTemplates = 0;
    let populatedReferences = 0;
    let fixedInconsistencies = 0;

    // Step 1: Migrate template attachments from embedded objects to IDs
    const templates = await EmailTemplateModel.find({ name: session.username }).lean();
    for (const template of templates) {
      if (template.attachments && Array.isArray(template.attachments)) {
        const firstAttachment = template.attachments[0];

        // Check if it's still in old format (embedded objects)
        const firstAtt = firstAttachment as any;
        if (firstAtt && typeof firstAtt === 'object' && firstAtt.filename && firstAtt.content) {
          const attachmentIds: string[] = [];

          // ponytail: inlined instead of lib/utils/attachments#findOrCreateAttachment, which isn't userId-aware yet
          for (const att of template.attachments) {
            const attObj = att as any;
            if (typeof attObj === 'object' && attObj.filename && attObj.content) {
              const existing = await AttachmentModel.findOne({
                userId: session.username,
                content: attObj.content,
              }).select("_id");
              const id = existing
                ? existing._id.toString()
                : (
                    await AttachmentModel.create({
                      filename: attObj.filename,
                      content: attObj.content,
                      contentType: attObj.contentType,
                      size: attObj.size,
                      userId: session.username,
                      referencedByApplications: [],
                      referencedByTemplates: [],
                    })
                  )._id.toString();
              attachmentIds.push(id);
            }
          }
          
          // Update template with IDs
          await EmailTemplateModel.updateOne(
            { _id: template._id, name: session.username },
            { $set: { attachments: attachmentIds } }
          );
          
          // Update attachment references
          const { syncTemplateAttachmentReferences } = await import("@/lib/utils/attachments");
          await syncTemplateAttachmentReferences(AttachmentModel, session.username, template.name, [], attachmentIds);
          
          migratedTemplates++;
        }
      }
    }
    
    // Step 2: Populate attachment reference fields from applications
    const applications = await WorkspaceApplicationModel.find({ userId: session.username }, "_id attachments").lean();
    for (const app of applications) {
      if (app.attachments && Array.isArray(app.attachments) && app.attachments.length > 0) {
        const { syncApplicationAttachmentReferences } = await import("@/lib/utils/attachments");
        // Get current references (might be empty)
        const attachment = await AttachmentModel.findOne({ _id: app.attachments[0], userId: session.username });
        const currentRefs = attachment?.referencedByApplications || [];
        const hasRef = currentRefs.includes(app._id.toString());
        
        if (!hasRef) {
          await syncApplicationAttachmentReferences(AttachmentModel, session.username, app._id.toString(), [], app.attachments);
          populatedReferences++;
        }
      }
    }
    
    // Step 3: Verify and fix inconsistencies
    const allAttachments = await AttachmentModel.find({ userId: session.username }, '_id referencedByApplications referencedByTemplates').lean();
    for (const att of allAttachments) {
      const attachmentId = att._id.toString();
      const storedAppRefs = (att.referencedByApplications || []).map((id: any) => id.toString());
      const storedTemplateRefs = (att.referencedByTemplates || []).map((id: any) => id.toString());

      // Check applications
      const appsWithThisAttachment = await WorkspaceApplicationModel.find({
        attachments: attachmentId,
        userId: session.username,
      }, '_id').lean();
      const actualAppRefs = appsWithThisAttachment.map((app: any) => app._id.toString());

      // Check templates
      const templatesWithThisAttachment = await EmailTemplateModel.find({
        attachments: attachmentId,
        name: session.username,
      }, 'name').lean();
      const actualTemplateRefs = templatesWithThisAttachment.map((t: any) => t.name);

      // Fix if inconsistent
      const appRefsMatch = JSON.stringify([...storedAppRefs].sort()) === JSON.stringify([...actualAppRefs].sort());
      const templateRefsMatch = JSON.stringify([...storedTemplateRefs].sort()) === JSON.stringify([...actualTemplateRefs].sort());

      if (!appRefsMatch || !templateRefsMatch) {
        await AttachmentModel.updateOne(
          { _id: att._id, userId: session.username },
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

