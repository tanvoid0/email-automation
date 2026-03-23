import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import {
  WorkspaceApplicationModel,
  WORKSPACE_KIND_ADMISSION,
} from "@/lib/models/WorkspaceApplication";
import { AdmissionPaymentModel } from "@/lib/models/AdmissionPayment";
import { AttachmentModel } from "@/lib/models/Attachment";
import "@/lib/models/SOP";
import { admissionUpdateSchema } from "@/lib/validations/admission";
import { attachmentSchema } from "@/lib/validations/attachment";
import { getErrorMessage } from "@/lib/types/errors";
import type { ApiErrorResponse } from "@/lib/types/api";
import { syncAdmissionSopLink } from "@/lib/utils/admission-sop-sync";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;
    const admission = await WorkspaceApplicationModel.findOne({
      _id: id,
      kind: WORKSPACE_KIND_ADMISSION,
    })
      .populate("sopId", "title")
      .lean();
    if (!admission) {
      return NextResponse.json({ error: "Admission not found" }, { status: 404 });
    }
    return NextResponse.json(admission);
  } catch (error: unknown) {
    const errorMessage = getErrorMessage(error);
    console.error("Error fetching admission:", errorMessage);
    const errorResponse: ApiErrorResponse = {
      error: errorMessage || "Failed to fetch admission",
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;
    const body = await request.json();

    const admission = await WorkspaceApplicationModel.findOne({
      _id: id,
      kind: WORKSPACE_KIND_ADMISSION,
    });
    if (!admission) {
      return NextResponse.json({ error: "Admission not found" }, { status: 404 });
    }

    const previousSopId = admission.sopId?.toString();

    if (body.attachments !== undefined) {
      if (Array.isArray(body.attachments) && body.attachments.length > 0) {
        const { findOrCreateAttachment } = await import("@/lib/utils/attachments");
        const attachmentPromises = body.attachments.map(async (att: unknown) => {
          if (typeof att === "string") {
            if (/^[0-9a-fA-F]{24}$/.test(att.trim())) return att.trim();
            return null;
          }
          if (typeof att === "object" && att !== null && "filename" in att) {
            const validationResult = attachmentSchema.safeParse(att);
            if (!validationResult.success) {
              throw new Error(`Invalid attachment: ${validationResult.error.message}`);
            }
            return await findOrCreateAttachment(AttachmentModel, validationResult.data);
          }
          return null;
        });
        const resolvedIds = (await Promise.all(attachmentPromises)).filter((x): x is string => x !== null);
        body.attachments = Array.from(new Set(resolvedIds));
      } else {
        body.attachments = [];
      }
    }

    const validationResult = admissionUpdateSchema.safeParse({
      universityName: body.universityName,
      programName: body.programName,
      degree: body.degree,
      country: body.country,
      term: body.term,
      applicationUrl: body.applicationUrl,
      scholarshipUrl: body.scholarshipUrl,
      departmentUrl: body.departmentUrl,
      statusPortalUrl: body.statusPortalUrl,
      sopId: body.sopId === null ? null : body.sopId,
      attachments: body.attachments,
      stage: body.stage,
      sortOrder: body.sortOrder,
      checklist: body.checklist,
      deadlines: body.deadlines,
      contacts: body.contacts,
      notes: body.notes,
      priority: body.priority,
      decision: body.decision,
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
    if (data.universityName !== undefined) admission.universityName = data.universityName;
    if (data.programName !== undefined) admission.programName = data.programName;
    if (data.degree !== undefined) admission.degree = data.degree;
    if (data.country !== undefined) admission.country = data.country;
    if (data.term !== undefined) admission.term = data.term;
    if (data.applicationUrl !== undefined) admission.applicationUrl = data.applicationUrl;
    if (data.scholarshipUrl !== undefined) admission.scholarshipUrl = data.scholarshipUrl;
    if (data.departmentUrl !== undefined) admission.departmentUrl = data.departmentUrl;
    if (data.statusPortalUrl !== undefined) admission.statusPortalUrl = data.statusPortalUrl;
    if (data.stage !== undefined) admission.stage = data.stage;
    if (data.sortOrder !== undefined) admission.sortOrder = data.sortOrder;
    if (data.checklist !== undefined) {
      admission.checklist = data.checklist;
      admission.markModified("checklist");
    }
    if (data.deadlines !== undefined) {
      admission.deadlines = data.deadlines;
      admission.markModified("deadlines");
    }
    if (data.contacts !== undefined) {
      admission.contacts = data.contacts;
      admission.markModified("contacts");
    }
    if (data.notes !== undefined) admission.notes = data.notes;
    if (data.priority !== undefined) admission.priority = data.priority;
    if (data.decision !== undefined) admission.decision = data.decision;
    if (data.attachments !== undefined) {
      admission.attachments = data.attachments;
      admission.markModified("attachments");
    }
    if (Object.prototype.hasOwnProperty.call(body, "sopId")) {
      admission.sopId =
        body.sopId === null || body.sopId === ""
          ? undefined
          : data.sopId
            ? new mongoose.Types.ObjectId(data.sopId)
            : undefined;
    }

    await admission.save();

    const newSopId = admission.sopId?.toString();
    await syncAdmissionSopLink(id, newSopId, previousSopId);

    const updated = await WorkspaceApplicationModel.findOne({
      _id: id,
      kind: WORKSPACE_KIND_ADMISSION,
    })
      .populate("sopId", "title")
      .lean();
    return NextResponse.json(updated);
  } catch (error: unknown) {
    const errorMessage = getErrorMessage(error);
    console.error("Error updating admission:", errorMessage);
    const errorResponse: ApiErrorResponse = {
      error: errorMessage || "Failed to update admission",
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;
    const admission = await WorkspaceApplicationModel.findOneAndDelete({
      _id: id,
      kind: WORKSPACE_KIND_ADMISSION,
    });
    if (!admission) {
      return NextResponse.json({ error: "Admission not found" }, { status: 404 });
    }
    await AdmissionPaymentModel.deleteMany({
      workspaceApplicationId: new mongoose.Types.ObjectId(id),
    });
    await syncAdmissionSopLink(id, undefined, admission.sopId?.toString());
    return NextResponse.json({ message: "Admission deleted successfully" });
  } catch (error: unknown) {
    const errorMessage = getErrorMessage(error);
    console.error("Error deleting admission:", errorMessage);
    const errorResponse: ApiErrorResponse = {
      error: errorMessage || "Failed to delete admission",
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
