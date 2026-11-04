import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { AppSettingsModel } from "@/lib/models/AppSettings";
import { admissionSettingsPatchSchema } from "@/lib/validations/appSettings";
import { getErrorMessage } from "@/lib/types/errors";
import type { ApiErrorResponse } from "@/lib/types/api";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" } satisfies ApiErrorResponse, { status: 401 });
    }

    await connectDB();
    const doc = await AppSettingsModel.findOne({ key: session.username }).lean();
    return NextResponse.json({
      admissionLevel: doc?.admissionLevel ?? "",
      admissionSubjectArea: doc?.admissionSubjectArea ?? "",
    });
  } catch (error: unknown) {
    const errorMessage = getErrorMessage(error);
    return NextResponse.json({ error: errorMessage || "Failed to load settings" } satisfies ApiErrorResponse, {
      status: 500,
    });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" } satisfies ApiErrorResponse, { status: 401 });
    }

    await connectDB();
    const body = await request.json();
    const parsed = admissionSettingsPatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const data = parsed.data;
    const $set: Record<string, string> = { key: session.username };
    if (data.admissionLevel !== undefined) {
      $set.admissionLevel = data.admissionLevel.trim();
    }
    if (data.admissionSubjectArea !== undefined) {
      $set.admissionSubjectArea = data.admissionSubjectArea.trim();
    }

    const doc = await AppSettingsModel.findOneAndUpdate(
      { key: session.username },
      { $set },
      { new: true, upsert: true }
    );

    if (!doc) {
      return NextResponse.json({ error: "Failed to save settings" } satisfies ApiErrorResponse, { status: 500 });
    }

    return NextResponse.json({
      admissionLevel: doc.admissionLevel ?? "",
      admissionSubjectArea: doc.admissionSubjectArea ?? "",
    });
  } catch (error: unknown) {
    const errorMessage = getErrorMessage(error);
    return NextResponse.json({ error: errorMessage || "Failed to save settings" } satisfies ApiErrorResponse, {
      status: 500,
    });
  }
}
