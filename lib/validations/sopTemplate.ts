import { z } from "zod";

const templateSectionSchema = z.object({
  key: z.string().min(1, "Section key is required"),
  label: z.string().min(1, "Section label is required"),
  placeholder: z.string().optional(),
  order: z.number().int().min(0),
});

export const sopTemplateSchema = z.object({
  name: z.string().min(1, "Template name is required").min(2, "Template name must be at least 2 characters"),
  description: z.string().optional(),
  sections: z.array(templateSectionSchema).min(1, "At least one section is required"),
});

export const sopTemplateUpdateSchema = sopTemplateSchema.partial();

export type TemplateSectionInput = z.infer<typeof templateSectionSchema>;
export type SopTemplateFormData = z.infer<typeof sopTemplateSchema>;
