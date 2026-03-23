import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import {
  WorkspaceApplicationModel,
  WORKSPACE_KIND_ADMISSION,
} from "@/lib/models/WorkspaceApplication";
import { AdmissionPaymentModel } from "@/lib/models/AdmissionPayment";
import { admissionPaymentCreateSchema } from "@/lib/validations/admissionPayment";
import { getErrorMessage } from "@/lib/types/errors";
import type { ApiErrorResponse } from "@/lib/types/api";
import { leanPaymentToRecord } from "@/lib/utils/admission-payments";

export const dynamic = "force-dynamic";

function parsePaidAt(s?: string): Date | undefined {
  if (!s?.trim()) return undefined;
  const d = new Date(s.trim());
  return Number.isNaN(d.getTime()) ? undefined : d;
}

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
      .select("_id")
      .lean();
    if (!admission) {
      return NextResponse.json({ error: "Admission not found" }, { status: 404 });
    }
    const rows = await AdmissionPaymentModel.find({
      workspaceApplicationId: new mongoose.Types.ObjectId(id),
    })
      .sort({ createdAt: 1 })
      .lean();
    return NextResponse.json(rows.map((r) => leanPaymentToRecord(r)));
  } catch (error: unknown) {
    const errorMessage = getErrorMessage(error);
    return NextResponse.json({ error: errorMessage || "Failed to list payments" } satisfies ApiErrorResponse, {
      status: 500,
    });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;
    const admission = await WorkspaceApplicationModel.findOne({
      _id: id,
      kind: WORKSPACE_KIND_ADMISSION,
    })
      .select("_id")
      .lean();
    if (!admission) {
      return NextResponse.json({ error: "Admission not found" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = admissionPaymentCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const d = parsed.data;
    const label = d.label?.trim() || "Application fee";
    let status = d.status ?? "pending";
    let paidAt = parsePaidAt(d.paidAt);
    if (status === "paid" && !paidAt) {
      paidAt = new Date();
    }
    if (status === "waived") {
      paidAt = undefined;
    }

    const doc = await AdmissionPaymentModel.create({
      workspaceApplicationId: new mongoose.Types.ObjectId(id),
      label,
      amountText: d.amountText,
      amountValue: d.amountValue,
      currency: d.currency,
      paymentUrl: d.paymentUrl,
      note: d.note,
      status,
      paidAt,
    });
    return NextResponse.json(leanPaymentToRecord(doc.toObject()), { status: 201 });
  } catch (error: unknown) {
    const errorMessage = getErrorMessage(error);
    return NextResponse.json({ error: errorMessage || "Failed to create payment" } satisfies ApiErrorResponse, {
      status: 500,
    });
  }
}
