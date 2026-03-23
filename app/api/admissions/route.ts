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
import { admissionSchema } from "@/lib/validations/admission";
import { attachmentSchema } from "@/lib/validations/attachment";
import { getErrorMessage } from "@/lib/types/errors";
import type { ApiErrorResponse } from "@/lib/types/api";
import { syncAdmissionSopLink } from "@/lib/utils/admission-sop-sync";
import { leanPaymentToBrief } from "@/lib/utils/admission-payments";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const stage = request.nextUrl.searchParams.get("stage");
    const filter: Record<string, unknown> = { kind: WORKSPACE_KIND_ADMISSION };
    if (stage) filter.stage = stage;
    const admissions = await WorkspaceApplicationModel.find(filter)
      .sort({ sortOrder: 1, updatedAt: -1 })
      .populate("sopId", "title")
      .lean();

    const ids = admissions.map((a) => a._id as mongoose.Types.ObjectId);
    const paymentByAdmission = new Map<string, ReturnType<typeof leanPaymentToBrief>[]>();
    if (ids.length > 0) {
      const allPayments = await AdmissionPaymentModel.find({
        workspaceApplicationId: { $in: ids },
      })
        .sort({ createdAt: 1 })
        .lean();
      for (const p of allPayments) {
        const k = String(p.workspaceApplicationId);
        if (!paymentByAdmission.has(k)) paymentByAdmission.set(k, []);
        paymentByAdmission.get(k)!.push(leanPaymentToBrief(p));
      }
    }

    const withPayments = admissions.map((a) => ({
      ...a,
      payments: paymentByAdmission.get(String(a._id)) ?? [],
    }));

    return NextResponse.json(withPayments);
  } catch (error: unknown) {
    const errorMessage = getErrorMessage(error);
    console.error("Error fetching admissions:", errorMessage);
    const errorResponse: ApiErrorResponse = {
      error: errorMessage || "Failed to fetch admissions",
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const body = await request.json();

    let attachmentIds: string[] = [];
    if (body.attachments && Array.isArray(body.attachments) && body.attachments.length > 0) {
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
      attachmentIds = (await Promise.all(attachmentPromises)).filter((id): id is string => id !== null);
      attachmentIds = Array.from(new Set(attachmentIds));
    }

    const validationResult = admissionSchema.safeParse({
      universityName: body.universityName,
      programName: body.programName,
      degree: body.degree,
      country: body.country,
      term: body.term,
      applicationUrl: body.applicationUrl,
      scholarshipUrl: body.scholarshipUrl,
      departmentUrl: body.departmentUrl,
      statusPortalUrl: body.statusPortalUrl,
      sopId: body.sopId,
      attachments: attachmentIds.length > 0 ? attachmentIds : body.attachments,
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
    const finalAttachmentIds =
      attachmentIds.length > 0 ? attachmentIds : (data.attachments ?? []);

    const doc = await WorkspaceApplicationModel.create({
      kind: WORKSPACE_KIND_ADMISSION,
      universityName: data.universityName,
      programName: data.programName,
      degree: data.degree,
      country: data.country,
      term: data.term,
      applicationUrl: data.applicationUrl,
      scholarshipUrl: data.scholarshipUrl,
      departmentUrl: data.departmentUrl,
      statusPortalUrl: data.statusPortalUrl,
      sopId: data.sopId ? new mongoose.Types.ObjectId(data.sopId) : undefined,
      attachments: finalAttachmentIds,
      stage: data.stage,
      sortOrder: data.sortOrder ?? 0,
      checklist: data.checklist ?? [],
      deadlines: data.deadlines ?? [],
      contacts: data.contacts ?? [],
      notes: data.notes,
      priority: data.priority,
      decision: data.decision,
    });

    if (data.sopId) {
      await syncAdmissionSopLink(doc._id.toString(), data.sopId, undefined);
    }

    const populated = await WorkspaceApplicationModel.findById(doc._id).populate("sopId", "title").lean();
    return NextResponse.json(populated, { status: 201 });
  } catch (error: unknown) {
    const errorMessage = getErrorMessage(error);
    console.error("Error creating admission:", errorMessage);
    const errorResponse: ApiErrorResponse = {
      error: errorMessage || "Failed to create admission",
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
