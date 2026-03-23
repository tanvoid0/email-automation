/**
 * Payments / fees linked to a university admission (`WorkspaceApplication` with `kind: university_admission`).
 * Stored in `admission_payments` — not embedded on the application document.
 */

export const ADMISSION_PAYMENT_STATUSES = ["pending", "paid", "waived"] as const;
export type AdmissionPaymentStatus = (typeof ADMISSION_PAYMENT_STATUSES)[number];

/** Full record from API (detail / payments CRUD). */
export interface AdmissionPaymentRecord {
  _id: string;
  workspaceApplicationId: string;
  label: string;
  amountText?: string;
  amountValue?: number;
  currency?: string;
  paymentUrl?: string;
  note?: string;
  status: AdmissionPaymentStatus;
  /** ISO timestamp when marked paid */
  paidAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** Attached to each row in `GET /api/admissions` for list/kanban badges. */
export interface AdmissionPaymentBrief {
  _id: string;
  label: string;
  status: AdmissionPaymentStatus;
  amountText?: string;
  currency?: string;
  paidAt?: string;
}
