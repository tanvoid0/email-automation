/**
 * University admission tracking — persisted as `WorkspaceApplication` with `kind: university_admission`.
 */

import type { AdmissionPaymentBrief } from "@/lib/types/admissionPayment";

export const ADMISSION_STAGES = [
  "researching",
  "in_progress",
  "ready_to_submit",
  "submitted",
  "under_review",
  "interview",
  "decision",
  "scholarship",
  "archived",
] as const;

export type AdmissionStage = (typeof ADMISSION_STAGES)[number];

export const ADMISSION_PRIORITIES = ["low", "normal", "high"] as const;
export type AdmissionPriority = (typeof ADMISSION_PRIORITIES)[number];

export const ADMISSION_DECISIONS = ["unknown", "accepted", "rejected", "waitlist"] as const;
export type AdmissionDecision = (typeof ADMISSION_DECISIONS)[number];

export interface AdmissionChecklistItem {
  id: string;
  label: string;
  done: boolean;
  dueDate?: string;
  weight?: number;
}

export interface AdmissionDeadline {
  label: string;
  date?: string;
  type?: "admission" | "scholarship" | "document" | "other";
}

export interface AdmissionContact {
  role: string;
  email?: string;
  name?: string;
  notes?: string;
}

export interface AdmissionApplication {
  id: string;
  universityName: string;
  programName?: string;
  degree?: string;
  country?: string;
  term?: string;
  applicationUrl?: string;
  scholarshipUrl?: string;
  departmentUrl?: string;
  statusPortalUrl?: string;
  sopId?: string;
  attachmentIds: string[];
  stage: AdmissionStage;
  sortOrder: number;
  checklist: AdmissionChecklistItem[];
  deadlines: AdmissionDeadline[];
  contacts: AdmissionContact[];
  notes?: string;
  priority: AdmissionPriority;
  decision: AdmissionDecision;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdmissionApiResponse {
  _id: string;
  /** Unified store discriminator — always `university_admission` for this API */
  kind?: "university_admission";
  universityName: string;
  programName?: string;
  degree?: string;
  country?: string;
  term?: string;
  applicationUrl?: string;
  scholarshipUrl?: string;
  departmentUrl?: string;
  statusPortalUrl?: string;
  sopId?: string | { _id: string; title: string };
  /** Attachment ObjectId strings */
  attachments?: string[];
  stage: AdmissionStage;
  sortOrder: number;
  checklist: AdmissionChecklistItem[];
  deadlines: AdmissionDeadline[];
  contacts: AdmissionContact[];
  notes?: string;
  priority: AdmissionPriority;
  decision: AdmissionDecision;
  /** Included on `GET /api/admissions` list responses */
  payments?: AdmissionPaymentBrief[];
  createdAt?: string;
  updatedAt?: string;
}
