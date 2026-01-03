import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { EmailTemplateModel } from "@/lib/models/EmailTemplate";
import { AttachmentModel } from "@/lib/models/Attachment";
import { DEFAULT_EMAIL_TEMPLATE, DEFAULT_EMAIL_SUBJECT } from "@/lib/constants/emailTemplate";
import mongoose from "mongoose";

export const dynamic = "force-dynamic";

// GET template
export async function GET() {
  try {
    await connectDB();
    let template = await EmailTemplateModel.findOne({ name: "default" });
    
    console.log("[Template API] GET request - Template found:", !!template);
    
    if (!template) {
      console.log("[Template API] Creating default template");
      // Create default template if it doesn't exist (using constant as fallback)
      template = await EmailTemplateModel.create({
        name: "default",
        content: DEFAULT_EMAIL_TEMPLATE,
        description: "Default email template",
        subject: DEFAULT_EMAIL_SUBJECT,
        attachments: [],
      });
      console.log("[Template API] Default template created with empty attachments array");
    }

    console.log("[Template API] Raw template from DB:", {
      hasAttachments: !!template.attachments,
      attachmentsType: typeof template.attachments,
      attachmentsIsArray: Array.isArray(template.attachments),
      attachmentsLength: template.attachments?.length || 0,
    });

    // Always return DB template (single source of truth is the database)
    // Convert to plain object and ensure attachments is always an array
    const templateData = template.toObject ? template.toObject() : template;
    
    // Ensure attachments is an array of IDs (not embedded objects)
    if (!templateData.attachments) {
      templateData.attachments = [];
    } else if (!Array.isArray(templateData.attachments)) {
      templateData.attachments = [];
    } else {
      // Convert to strings if needed
      templateData.attachments = templateData.attachments.map((id: any) => id.toString());
    }
    
    return NextResponse.json(templateData);
  } catch (error: any) {
    console.error("Error fetching template:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch template" },
      { status: 500 }
    );
  }
}

// PUT update template
export async function PUT(request: NextRequest) {
  try {
    await connectDB();
    const body = await request.json();
    const { content, description, subject, attachments } = body;

    console.log("[Template API] PUT request received:", {
      hasContent: !!content,
      hasDescription: !!description,
      hasSubject: !!subject,
      hasAttachments: attachments !== undefined,
      attachmentsType: typeof attachments,
      attachmentsIsArray: Array.isArray(attachments),
      attachmentsLength: attachments?.length || 0,
      attachments: attachments,
    });

    if (!content) {
      return NextResponse.json(
        { error: "Template content is required" },
        { status: 400 }
      );
    }

    // Find or create template
    let template = await EmailTemplateModel.findOne({ name: "default" });
    
    if (!template) {
      console.log("[Template API] Template not found, creating new one");
      template = await EmailTemplateModel.create({
        name: "default",
        content,
        description,
        subject,
        attachments: attachments || [],
      });
      console.log("[Template API] New template created with attachments:", {
        count: template.attachments?.length || 0,
      });
    } else {
      console.log("[Template API] Updating existing template");
      // Update fields
      template.content = content;
      template.description = description;
      template.subject = subject;
      
      // Only update attachments if provided (preserve existing if not provided)
      let attachmentIdStrings: string[] | undefined = undefined;
      if (attachments !== undefined) {
        // Extract old attachment IDs, handling both embedded objects and string IDs
        const oldAttachmentIds: string[] = [];
        if (template.attachments && Array.isArray(template.attachments)) {
          for (const item of template.attachments) {
            if (typeof item === 'string') {
              oldAttachmentIds.push(item);
            } else if (item && typeof item === 'object') {
              const itemObj = item as any;
              if ('_id' in itemObj) {
                oldAttachmentIds.push(itemObj._id.toString());
              } else if ('id' in itemObj) {
                oldAttachmentIds.push(itemObj.id.toString());
              }
            }
          }
        }
        
        let newAttachmentIds: string[] = [];

        // Handle both old format (embedded objects) and new format (IDs)
        if (attachments.length > 0) {
          const firstAttachment = attachments[0];
          
          if (typeof firstAttachment === 'object' && firstAttachment !== null && firstAttachment.filename && firstAttachment.content) {
            // Old format: embedded objects - convert to IDs
            const { findOrCreateAttachment } = await import("@/lib/utils/attachments");
            const attachmentPromises = attachments.map(async (att: any) => {
              return await findOrCreateAttachment(AttachmentModel, {
                filename: att.filename,
                content: att.content,
                contentType: att.contentType,
                size: att.size,
              });
            });
            newAttachmentIds = await Promise.all(attachmentPromises);
          } else if (typeof firstAttachment === 'string') {
            // New format: already IDs
            newAttachmentIds = attachments.filter((id: any): id is string => 
              typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id.trim())
            );
          }
        }

        // Ensure attachments is set as an array of strings (IDs)
        // Use direct assignment and markModified to ensure Mongoose recognizes it as strings
        attachmentIdStrings = newAttachmentIds.map(id => String(id).trim());
        // Directly assign and mark as modified - Mongoose should respect the schema definition
        template.attachments = attachmentIdStrings;
        template.markModified('attachments');
        
        // Update attachment references
        const { syncTemplateAttachmentReferences } = await import("@/lib/utils/attachments");
        await syncTemplateAttachmentReferences(AttachmentModel, "default", oldAttachmentIds, attachmentIdStrings);
        
        console.log("[Template API] Setting attachments:", {
          count: attachmentIdStrings.length,
          attachmentIds: attachmentIdStrings,
        });
      } else {
        console.log("[Template API] No attachments provided, preserving existing");
      }
      
      // Save the document - use direct MongoDB update to bypass Mongoose casting issues
      try {
        await template.save();
      } catch (saveError: any) {
        // If save fails due to schema mismatch (embedded object casting), use direct MongoDB update
        if (saveError.name === 'ValidationError' || saveError.message?.includes('Cast to embedded')) {
          console.log("[Template API] Schema mismatch detected, using direct MongoDB update");
          // Use direct MongoDB connection to bypass Mongoose schema validation entirely
          const db = mongoose.connection.db;
          
          if (!db) {
            throw new Error("Database connection not available");
          }
          
          const updateData: any = {
            content: template.content,
            description: template.description,
            subject: template.subject,
          };
          
          if (attachmentIdStrings !== undefined) {
            updateData.attachments = attachmentIdStrings;
          }
          
          // Use native MongoDB update to completely bypass Mongoose schema
          await db.collection("emailtemplates").updateOne(
            { name: "default" },
            { $set: updateData }
          );
          
          console.log("[Template API] Direct MongoDB update completed");
          
          // Reload the template to get the updated version
          template = await EmailTemplateModel.findOne({ name: "default" });
          if (!template) {
            throw new Error("Failed to reload template after update");
          }
        } else {
          throw saveError;
        }
      }
      console.log("[Template API] Template saved, attachments after save:", {
        count: template.attachments?.length || 0,
      });
    }

    // Reload from database to verify what was actually saved
    const savedTemplate = await EmailTemplateModel.findOne({ name: "default" });
    console.log("[Template API] Template updated, raw template from DB:", {
      hasAttachments: !!savedTemplate?.attachments,
      attachmentsType: typeof savedTemplate?.attachments,
      attachmentsIsArray: Array.isArray(savedTemplate?.attachments),
      attachmentsLength: savedTemplate?.attachments?.length || 0,
      attachments: savedTemplate?.attachments,
    });
    
    // Use the saved template for response
    template = savedTemplate || template;

    // Convert to plain object and ensure attachments is always an array
    const templateData = template.toObject ? template.toObject() : template;
    if (!templateData.attachments) {
      console.log("[Template API] Attachments missing in templateData, setting to empty array");
      templateData.attachments = [];
    } else {
      console.log("[Template API] Template data attachments:", {
        count: templateData.attachments.length,
        attachments: templateData.attachments,
      });
    }

    console.log("[Template API] Returning template data:", {
      hasAttachments: !!templateData.attachments,
      attachmentsLength: templateData.attachments?.length || 0,
    });

    return NextResponse.json(templateData);
  } catch (error: any) {
    console.error("Error updating template:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update template" },
      { status: 500 }
    );
  }
}

