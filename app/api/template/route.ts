import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { EmailTemplateModel } from "@/lib/models/EmailTemplate";
import { DEFAULT_EMAIL_TEMPLATE, DEFAULT_EMAIL_SUBJECT } from "@/lib/constants/emailTemplate";

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
    console.log("[Template API] Template data after toObject:", {
      hasAttachments: !!templateData.attachments,
      attachmentsType: typeof templateData.attachments,
      attachmentsIsArray: Array.isArray(templateData.attachments),
      attachmentsLength: templateData.attachments?.length || 0,
    });
    
    if (!templateData.attachments) {
      console.log("[Template API] Attachments missing, setting to empty array");
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
      if (attachments !== undefined) {
        template.attachments = attachments;
        // Mark the nested array as modified so Mongoose saves it
        template.markModified('attachments');
        console.log("[Template API] Setting attachments:", {
          count: attachments.length,
          firstAttachment: attachments[0] ? {
            filename: attachments[0].filename,
            hasContent: !!attachments[0].content,
            contentLength: attachments[0].content?.length || 0,
            contentType: attachments[0].contentType,
          } : null,
        });
      } else {
        console.log("[Template API] No attachments provided, preserving existing");
      }
      
      // Save the document to ensure Mongoose properly handles nested arrays
      await template.save();
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

