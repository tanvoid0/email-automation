import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import { SOPModel } from "@/lib/models/SOP";
import "@/lib/models/SopTemplate";
import {
  WorkspaceApplicationModel,
  WORKSPACE_KIND_ADMISSION,
} from "@/lib/models/WorkspaceApplication";
import { syncSopAdmissionLink } from "@/lib/utils/admission-sop-sync";
import { sopUpdateSchema } from "@/lib/validations/sop";
import { getErrorMessage } from "@/lib/types/errors";
import type { ApiErrorResponse } from "@/lib/types/api";
import { mergeSectionsToContent } from "@/lib/utils/sop";

export const dynamic = "force-dynamic";

// GET single SOP
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;
    const sop = await SOPModel.findById(id)
      .populate("applicationId", "name university")
      .populate("admissionApplicationId", "universityName programName")
      .lean();

    if (!sop) {
      return NextResponse.json({ error: "SOP not found" }, { status: 404 });
    }

    return NextResponse.json(sop);
  } catch (error: unknown) {
    const errorMessage = getErrorMessage(error);
    console.error("Error fetching SOP:", errorMessage);
    const errorResponse: ApiErrorResponse = {
      error: errorMessage || "Failed to fetch SOP",
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

// PATCH update SOP
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;
    const body = await request.json();

    const sop = await SOPModel.findById(id);
    if (!sop) {
      return NextResponse.json({ error: "SOP not found" }, { status: 404 });
    }

    const previousAdmissionId = sop.admissionApplicationId?.toString();

    const validationResult = sopUpdateSchema.safeParse({
      title: body.title,
      content: body.content ?? "",
      applicationId: body.applicationId ?? "",
      admissionApplicationId: body.admissionApplicationId ?? "",
      templateId: body.templateId ?? "",
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
    if (data.title !== undefined) sop.title = data.title.trim();
    if (Object.prototype.hasOwnProperty.call(body, "sections") && data.sections && data.sections.length > 0) {
      sop.sections = data.sections;
      sop.content = mergeSectionsToContent(data.sections);
    } else if (data.content !== undefined) {
      sop.content = data.content.trim();
    }
    if (Object.prototype.hasOwnProperty.call(body, "applicationId")) {
      sop.applicationId = data.applicationId
        ? new mongoose.Types.ObjectId(data.applicationId)
        : undefined;
    }
    if (Object.prototype.hasOwnProperty.call(body, "templateId")) {
      sop.templateId = data.templateId
        ? new mongoose.Types.ObjectId(data.templateId)
        : undefined;
    }
    if (Object.prototype.hasOwnProperty.call(body, "admissionApplicationId")) {
      sop.admissionApplicationId = data.admissionApplicationId
        ? new mongoose.Types.ObjectId(data.admissionApplicationId)
        : undefined;
    }

    await sop.save();

    if (Object.prototype.hasOwnProperty.call(body, "admissionApplicationId")) {
      await syncSopAdmissionLink(
        id,
        data.admissionApplicationId,
        previousAdmissionId
      );
    }

    const updated = await SOPModel.findById(id)
      .populate("applicationId", "name university")
      .populate("admissionApplicationId", "universityName programName")
      .lean();
    return NextResponse.json(updated);
  } catch (error: unknown) {
    const errorMessage = getErrorMessage(error);
    console.error("Error updating SOP:", errorMessage);
    const errorResponse: ApiErrorResponse = {
      error: errorMessage || "Failed to update SOP",
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

// DELETE SOP
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;
    const sop = await SOPModel.findByIdAndDelete(id);

    if (!sop) {
      return NextResponse.json({ error: "SOP not found" }, { status: 404 });
    }

    const sopOid = sop._id;
    await WorkspaceApplicationModel.updateMany(
      { kind: WORKSPACE_KIND_ADMISSION, sopId: sopOid },
      { $unset: { sopId: 1 } }
    );

    return NextResponse.json({ message: "SOP deleted successfully" });
  } catch (error: unknown) {
    const errorMessage = getErrorMessage(error);
    console.error("Error deleting SOP:", errorMessage);
    const errorResponse: ApiErrorResponse = {
      error: errorMessage || "Failed to delete SOP",
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
