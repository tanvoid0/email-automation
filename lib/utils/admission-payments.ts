import type { AdmissionPaymentBrief, AdmissionPaymentRecord, AdmissionPaymentStatus } from "@/lib/types/admissionPayment";
import type { AdmissionStage } from "@/lib/types/admission";

const PRE_SUBMIT_STAGES = new Set<AdmissionStage>(["researching", "in_progress", "ready_to_submit"]);

export function admissionPaymentStatusLabel(status: AdmissionPaymentStatus): string {
  switch (status) {
    case "paid":
      return "Paid";
    case "waived":
      return "Waived";
    default:
      return "Pending";
  }
}

/** True if any payment is still pending while the application is pre-submit or early post-submit. */
export function admissionPaymentsNeedAttention(
  stage: AdmissionStage,
  payments: Pick<AdmissionPaymentBrief, "status">[]
): boolean {
  const pending = payments.filter((p) => p.status === "pending");
  if (pending.length === 0) return false;
  if (PRE_SUBMIT_STAGES.has(stage)) return true;
  if (stage === "submitted" || stage === "under_review") return true;
  return false;
}

export function leanPaymentToRecord(doc: {
  _id: unknown;
  workspaceApplicationId: unknown;
  label?: string;
  amountText?: string;
  amountValue?: number;
  currency?: string;
  paymentUrl?: string;
  note?: string;
  status: AdmissionPaymentStatus;
  paidAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}): AdmissionPaymentRecord {
  return {
    _id: String(doc._id),
    workspaceApplicationId: String(doc.workspaceApplicationId),
    label: doc.label ?? "Application fee",
    amountText: doc.amountText,
    amountValue: doc.amountValue,
    currency: doc.currency,
    paymentUrl: doc.paymentUrl,
    note: doc.note,
    status: doc.status,
    paidAt: doc.paidAt ? new Date(doc.paidAt).toISOString() : undefined,
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : undefined,
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : undefined,
  };
}

export function leanPaymentToBrief(doc: {
  _id: unknown;
  label?: string;
  status: AdmissionPaymentStatus;
  amountText?: string;
  currency?: string;
  paidAt?: Date;
}): AdmissionPaymentBrief {
  return {
    _id: String(doc._id),
    label: doc.label ?? "Application fee",
    status: doc.status,
    amountText: doc.amountText,
    currency: doc.currency,
    paidAt: doc.paidAt ? new Date(doc.paidAt).toISOString() : undefined,
  };
}
