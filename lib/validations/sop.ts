import { z } from "zod";

const mongoIdOptional = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid ID format (must be 24 hex characters)")
  .optional()
  .nullable()
  .or(z.literal(""));

const sopSectionEntrySchema = z.object({
  key: z.string().min(1),
  content: z.string(),
});

const sopBaseSchema = z.object({
  title: z.string().min(1, "Title is required").min(2, "Title must be at least 2 characters"),
  content: z.string().optional().default(""),
  applicationId: mongoIdOptional.transform((v) => (v === "" || v == null ? undefined : v)),
  admissionApplicationId: mongoIdOptional.transform((v) => (v === "" || v == null ? undefined : v)),
  templateId: mongoIdOptional.transform((v) => (v === "" || v == null ? undefined : v)),
  sections: z.array(sopSectionEntrySchema).optional(),
});

export const sopSchema = sopBaseSchema.refine(
  (data) => {
    const hasContent = (data.content ?? "").trim().length >= 10;
    const hasSections = Array.isArray(data.sections) && data.sections.length > 0;
    return hasContent || hasSections;
  },
  { message: "Provide either content (min 10 chars) or at least one section.", path: ["content"] }
);

export const sopUpdateSchema = sopBaseSchema.partial();

export type SOPFormData = z.infer<typeof sopSchema>;
export type SOPUpdateData = z.infer<typeof sopUpdateSchema>;
