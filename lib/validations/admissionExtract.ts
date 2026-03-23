import { z } from "zod";

export const admissionExtractRequestSchema = z.object({
  primaryUrl: z.string().url(),
  /** User's short subject / program focus for this application, e.g. "MS Robotics Fall 2027" */
  contextSubject: z
    .string()
    .optional()
    .transform((s) => (s?.trim() ? s.trim() : undefined)),
  /** Overrides saved default when provided */
  admissionLevel: z
    .string()
    .optional()
    .transform((s) => (s?.trim() ? s.trim() : undefined)),
  admissionSubjectArea: z
    .string()
    .optional()
    .transform((s) => (s?.trim() ? s.trim() : undefined)),
});

export type AdmissionExtractRequest = z.infer<typeof admissionExtractRequestSchema>;

const deadlineOutSchema = z.object({
  label: z.string(),
  dateISO: z.string().optional().nullable(),
  dateText: z.string(),
  type: z.enum(["admission", "scholarship", "document", "other"]),
  notes: z.string().optional().nullable(),
});

export const admissionExtractResultSchema = z.object({
  universityName: z.string(),
  programName: z.string().optional().nullable(),
  degree: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  term: z.string().optional().nullable(),
  applicationUrl: z.string().optional().nullable(),
  scholarshipUrl: z.string().optional().nullable(),
  departmentUrl: z.string().optional().nullable(),
  statusPortalUrl: z.string().optional().nullable(),
  deadlines: z.array(deadlineOutSchema).default([]),
  checklistLabels: z.array(z.string()).default([]),
  notes: z.string().optional().nullable(),
  suggestedPayment: z
    .object({
      label: z.string().optional().nullable(),
      amountText: z.string().optional().nullable(),
      amountValue: z.number().optional().nullable(),
      currency: z.string().optional().nullable(),
      paymentUrl: z.string().optional().nullable(),
      note: z.string().optional().nullable(),
    })
    .optional()
    .nullable(),
  confidenceNote: z.string(),
  disclaimer: z.string(),
});

export type AdmissionExtractResult = z.infer<typeof admissionExtractResultSchema>;
