import { NextRequest, NextResponse } from "next/server";
import { customizeEmail } from "@/lib/gemini";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { baseTemplate, professorName, universityName } = body;

    if (!baseTemplate || !professorName || !universityName) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: baseTemplate, professorName, universityName",
        },
        { status: 400 }
      );
    }

    const customizedText = await customizeEmail({
      baseTemplate,
      professorName,
      universityName,
    });

    return NextResponse.json({ customizedText });
  } catch (error: any) {
    console.error("Gemini API error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to customize email" },
      { status: 500 }
    );
  }
}

