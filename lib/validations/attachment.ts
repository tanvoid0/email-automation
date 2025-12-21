import { z } from "zod";

export const attachmentSchema = z.object({
  filename: z.string().min(1, "Filename is required"),
  content: z.string().min(1, "Content is required"),
  contentType: z.string().optional(),
  size: z.number().optional(),
});

export type AttachmentFormData = z.infer<typeof attachmentSchema>;

