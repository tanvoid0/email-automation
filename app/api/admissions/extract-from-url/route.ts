import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { APP_SETTINGS_KEY_DEFAULT, AppSettingsModel } from "@/lib/models/AppSettings";
import { AdmissionExtractService } from "@/lib/services/AdmissionExtractService";
import { admissionExtractRequestSchema } from "@/lib/validations/admissionExtract";
import { getErrorMessage } from "@/lib/types/errors";
import type { ApiErrorResponse } from "@/lib/types/api";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = admissionExtractRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    await connectDB();
    const settings = await AppSettingsModel.findOne({ key: APP_SETTINGS_KEY_DEFAULT }).lean();

    const result = await AdmissionExtractService.extract(parsed.data, {
      admissionLevel: settings?.admissionLevel,
      admissionSubjectArea: settings?.admissionSubjectArea,
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    const errorMessage = getErrorMessage(error);
    console.error("[admissions/extract-from-url]", errorMessage);
    return NextResponse.json({ error: errorMessage || "Extract failed" } satisfies ApiErrorResponse, {
      status: 500,
    });
  }
}
