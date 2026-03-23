import { z } from "zod";
import { ADMISSION_DECISIONS, ADMISSION_PRIORITIES, ADMISSION_STAGES } from "@/lib/types/admission";

const mongoIdOptional = z
  .union([
    z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid ID format"),
    z.literal(""),
    z.null(),
  ])
  .optional()
  .transform((v) => (v === "" || v == null ? undefined : v));

const mongoIdArray = z
  .array(z.string().regex(/^[0-9a-fA-F]{24}$/))
  .optional()
  .default([]);

const checklistItemSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  done: z.boolean(),
  dueDate: z
    .string()
    .optional()
    .transform((s) => (s && s.trim() ? s.trim() : undefined)),
  weight: z.number().positive().optional(),
});

const deadlineSchema = z.object({
  label: z.string().min(1),
  date: z
    .string()
    .optional()
    .transform((s) => (s && s.trim() ? s.trim() : undefined)),
  type: z.enum(["admission", "scholarship", "document", "other"]).optional(),
});

const contactSchema = z.object({
  role: z.string().min(1),
  email: z
    .union([z.string().email(), z.literal("")])
    .optional()
    .transform((v) => (v === "" || v == null ? undefined : v)),
  name: z.string().optional(),
  notes: z.string().optional(),
});

const admissionBase = z.object({
  universityName: z.string().min(1, "University name is required").trim(),
  programName: z.string().optional().transform((s) => (s?.trim() ? s.trim() : undefined)),
  degree: z.string().optional().transform((s) => (s?.trim() ? s.trim() : undefined)),
  country: z.string().optional().transform((s) => (s?.trim() ? s.trim() : undefined)),
  term: z.string().optional().transform((s) => (s?.trim() ? s.trim() : undefined)),
  applicationUrl: z.string().url().optional().or(z.literal("").transform(() => undefined)),
  scholarshipUrl: z.string().url().optional().or(z.literal("").transform(() => undefined)),
  departmentUrl: z.string().url().optional().or(z.literal("").transform(() => undefined)),
  statusPortalUrl: z.string().url().optional().or(z.literal("").transform(() => undefined)),
  sopId: mongoIdOptional.transform((v) => (v === "" || v == null ? undefined : v)),
  attachments: mongoIdArray,
  stage: z.enum(ADMISSION_STAGES).optional().default("researching"),
  sortOrder: z.number().int().optional().default(0),
  checklist: z.array(checklistItemSchema).optional().default([]),
  deadlines: z.array(deadlineSchema).optional().default([]),
  contacts: z.array(contactSchema).optional().default([]),
  notes: z.string().optional(),
  priority: z.enum(ADMISSION_PRIORITIES).optional().default("normal"),
  decision: z.enum(ADMISSION_DECISIONS).optional().default("unknown"),
});

export const admissionSchema = admissionBase;

export const admissionUpdateSchema = admissionBase.partial();

export type AdmissionFormData = z.infer<typeof admissionSchema>;
export type AdmissionUpdateData = z.infer<typeof admissionUpdateSchema>;
