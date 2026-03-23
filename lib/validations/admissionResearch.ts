import { z } from "zod";

export const admissionResearchRequestSchema = z.object({
  universityName: z.string().min(1).trim(),
  programName: z.string().optional().transform((s) => (s?.trim() ? s.trim() : undefined)),
  degree: z.string().optional().transform((s) => (s?.trim() ? s.trim() : undefined)),
  country: z.string().optional().transform((s) => (s?.trim() ? s.trim() : undefined)),
  term: z.string().optional().transform((s) => (s?.trim() ? s.trim() : undefined)),
  focus: z.enum(["admission", "scholarship", "both"]).optional().default("both"),
  optionalUrls: z
    .array(z.string().url())
    .max(3)
    .optional()
    .default([]),
});

export type AdmissionResearchRequest = z.infer<typeof admissionResearchRequestSchema>;

const linkSchema = z.object({
  label: z.string(),
  url: z.string(),
  kind: z.string().optional(),
});

const deadlineSchema = z.object({
  label: z.string(),
  dateISO: z.string().optional().nullable(),
  dateText: z.string(),
  category: z.enum(["admission", "scholarship", "document", "other"]),
  notes: z.string().optional().nullable(),
});

const feeSchema = z.object({
  description: z.string(),
  amountText: z.string().optional().nullable(),
  currency: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const scholarshipSchema = z.object({
  name: z.string(),
  url: z.string().optional().nullable(),
  eligibilitySummary: z.string().optional().nullable(),
  deadlineText: z.string().optional().nullable(),
});

export const admissionResearchResultSchema = z.object({
  officialLinks: z.array(linkSchema).default([]),
  deadlines: z.array(deadlineSchema).default([]),
  fees: z.array(feeSchema).default([]),
  requirements: z.array(z.string()).default([]),
  processSteps: z.array(z.string()).default([]),
  scholarships: z.array(scholarshipSchema).default([]),
  confidenceNote: z.string(),
  disclaimer: z.string(),
  usedGrounding: z.boolean().optional().default(false),
});

export type AdmissionResearchResult = z.infer<typeof admissionResearchResultSchema>;
