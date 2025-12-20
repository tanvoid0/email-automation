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
    
    if (!template) {
      // Create default template if it doesn't exist (using constant as fallback)
      template = await EmailTemplateModel.create({
        name: "default",
        content: DEFAULT_EMAIL_TEMPLATE,
        description: "Default email template for professor outreach",
        subject: DEFAULT_EMAIL_SUBJECT,
      });
    }

    // Always return DB template (single source of truth is the database)
    return NextResponse.json(template);
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
    const { content, description, subject } = body;

    if (!content) {
      return NextResponse.json(
        { error: "Template content is required" },
        { status: 400 }
      );
    }

    const template = await EmailTemplateModel.findOneAndUpdate(
      { name: "default" },
      { content, description, subject },
      { new: true, upsert: true }
    );

    return NextResponse.json(template);
  } catch (error: any) {
    console.error("Error updating template:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update template" },
      { status: 500 }
    );
  }
}

