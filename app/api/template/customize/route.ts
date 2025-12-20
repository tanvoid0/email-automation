import { NextRequest, NextResponse } from "next/server";
import { customizeTemplate } from "@/lib/gemini";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { template, customizationPrompt } = body;

    if (!template) {
      return NextResponse.json(
        { error: "Template is required" },
        { status: 400 }
      );
    }

    const customizedText = await customizeTemplate({
      template,
      customizationPrompt,
    });

    return NextResponse.json({ customizedText });
  } catch (error: any) {
    console.error("Template customization error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to customize template" },
      { status: 500 }
    );
  }
}

