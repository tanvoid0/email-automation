import { NextRequest, NextResponse } from "next/server";
import { admissionResearchRequestSchema } from "@/lib/validations/admissionResearch";
import { AdmissionResearchService } from "@/lib/services/AdmissionResearchService";
import { getErrorMessage } from "@/lib/types/errors";
import type { ApiErrorResponse } from "@/lib/types/api";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = admissionResearchRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const result = await AdmissionResearchService.research(parsed.data);
    return NextResponse.json(result);
  } catch (error: unknown) {
    const errorMessage = getErrorMessage(error);
    console.error("[admissions/ai-research]", errorMessage);
    const errorResponse: ApiErrorResponse = {
      error: errorMessage || "Research failed",
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
