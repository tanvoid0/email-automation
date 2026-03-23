import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import { SOPModel } from "@/lib/models/SOP";
import "@/lib/models/WorkspaceApplication";
import "@/lib/models/SopTemplate";
import { syncSopAdmissionLink } from "@/lib/utils/admission-sop-sync";
import { sopSchema } from "@/lib/validations/sop";
import { getErrorMessage } from "@/lib/types/errors";
import type { ApiErrorResponse } from "@/lib/types/api";
import { mergeSectionsToContent } from "@/lib/utils/sop";

export const dynamic = "force-dynamic";

// GET all SOPs (with optional application info for list display)
export async function GET() {
  try {
    await connectDB();
    const sops = await SOPModel.find()
      .sort({ updatedAt: -1 })
      .populate("applicationId", "name university")
      .populate("admissionApplicationId", "universityName programName")
      .lean();
    return NextResponse.json(sops);
  } catch (error: unknown) {
    const errorMessage = getErrorMessage(error);
    console.error("Error fetching SOPs:", errorMessage);
    const errorResponse: ApiErrorResponse = {
      error: errorMessage || "Failed to fetch SOPs",
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

// POST create new SOP
export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const body = await request.json();

    const validationResult = sopSchema.safeParse({
      title: body.title,
      content: body.content ?? "",
      applicationId: body.applicationId ?? undefined,
      admissionApplicationId: body.admissionApplicationId ?? undefined,
      templateId: body.templateId ?? undefined,
      sections: body.sections,
    });

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validationResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const data = validationResult.data;
    const sections = data.sections && data.sections.length > 0 ? data.sections : undefined;
    const mergedContent =
      (data.content && data.content.trim().length >= 10
        ? data.content.trim()
        : sections
          ? mergeSectionsToContent(sections)
          : "") || "";

    const sop = await SOPModel.create({
      title: data.title.trim(),
      content: mergedContent,
      applicationId: data.applicationId ? new mongoose.Types.ObjectId(data.applicationId) : undefined,
      admissionApplicationId: data.admissionApplicationId
        ? new mongoose.Types.ObjectId(data.admissionApplicationId)
        : undefined,
      templateId: data.templateId ? new mongoose.Types.ObjectId(data.templateId) : undefined,
      sections: sections ?? [],
    });

    if (data.admissionApplicationId) {
      await syncSopAdmissionLink(
        sop._id.toString(),
        data.admissionApplicationId,
        undefined
      );
    }

    const created = await SOPModel.findById(sop._id)
      .populate("applicationId", "name university")
      .populate("admissionApplicationId", "universityName programName")
      .lean();
    return NextResponse.json(created, { status: 201 });
  } catch (error: unknown) {
    const errorMessage = getErrorMessage(error);
    console.error("Error creating SOP:", errorMessage);
    const errorResponse: ApiErrorResponse = {
      error: errorMessage || "Failed to create SOP",
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
