import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import {
  WorkspaceApplicationModel,
  WORKSPACE_KIND_ADMISSION,
} from "@/lib/models/WorkspaceApplication";
import { AdmissionPaymentModel } from "@/lib/models/AdmissionPayment";
import { admissionPaymentUpdateSchema } from "@/lib/validations/admissionPayment";
import { getErrorMessage } from "@/lib/types/errors";
import type { ApiErrorResponse } from "@/lib/types/api";
import { leanPaymentToRecord } from "@/lib/utils/admission-payments";

export const dynamic = "force-dynamic";

function parsePaidAt(s?: string): Date | undefined {
  if (!s?.trim()) return undefined;
  const d = new Date(s.trim());
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; paymentId: string }> }
) {
  try {
    await connectDB();
    const { id, paymentId } = await params;
    const admission = await WorkspaceApplicationModel.findOne({
      _id: id,
      kind: WORKSPACE_KIND_ADMISSION,
    })
      .select("_id")
      .lean();
    if (!admission) {
      return NextResponse.json({ error: "Admission not found" }, { status: 404 });
    }

    const payment = await AdmissionPaymentModel.findOne({
      _id: paymentId,
      workspaceApplicationId: new mongoose.Types.ObjectId(id),
    });
    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = admissionPaymentUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const d = parsed.data;

    if ("label" in d && d.label !== undefined) {
      payment.label = d.label.trim() || "Application fee";
    }
    if ("amountText" in d) payment.amountText = d.amountText?.trim() || undefined;
    if ("amountValue" in d) payment.amountValue = d.amountValue;
    if ("currency" in d) payment.currency = d.currency?.trim() || undefined;
    if ("paymentUrl" in d) payment.paymentUrl = d.paymentUrl?.trim() || undefined;
    if ("note" in d) payment.note = d.note?.trim() || undefined;

    if ("status" in d && d.status !== undefined) {
      payment.status = d.status;
      if (d.status === "waived") {
        payment.paidAt = undefined;
      }
      if (d.status === "paid" && !("paidAt" in d)) {
        if (!payment.paidAt) payment.paidAt = new Date();
      }
    }
    if ("paidAt" in d) {
      if (d.paidAt === "" || d.paidAt == null) {
        payment.paidAt = undefined;
      } else {
        payment.paidAt = parsePaidAt(d.paidAt);
      }
    }

    if (payment.status === "paid" && !payment.paidAt) {
      payment.paidAt = new Date();
    }

    await payment.save();
    return NextResponse.json(leanPaymentToRecord(payment.toObject()));
  } catch (error: unknown) {
    const errorMessage = getErrorMessage(error);
    return NextResponse.json({ error: errorMessage || "Failed to update payment" } satisfies ApiErrorResponse, {
      status: 500,
    });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; paymentId: string }> }
) {
  try {
    await connectDB();
    const { id, paymentId } = await params;
    const admission = await WorkspaceApplicationModel.findOne({
      _id: id,
      kind: WORKSPACE_KIND_ADMISSION,
    })
      .select("_id")
      .lean();
    if (!admission) {
      return NextResponse.json({ error: "Admission not found" }, { status: 404 });
    }

    const res = await AdmissionPaymentModel.findOneAndDelete({
      _id: paymentId,
      workspaceApplicationId: new mongoose.Types.ObjectId(id),
    });
    if (!res) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const errorMessage = getErrorMessage(error);
    return NextResponse.json({ error: errorMessage || "Failed to delete payment" } satisfies ApiErrorResponse, {
      status: 500,
    });
  }
}
