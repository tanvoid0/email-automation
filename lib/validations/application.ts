import { z } from "zod";

export const applicationSchema = z.object({
  name: z
    .string()
    .min(1, "Recipient name is required")
    .min(2, "Recipient name must be at least 2 characters"),
  university: z
    .string()
    .min(1, "University name is required")
    .min(2, "University name must be at least 2 characters"),
  email: z
    .string()
    .min(1, "Email is required")
    .email("Please enter a valid email address"),
  emailText: z
    .string()
    .min(1, "Email text is required")
    .min(10, "Email text must be at least 10 characters"),
  attachments: z.array(z.string()).optional().default([]), // Array of attachment IDs
});

export type ApplicationFormData = z.infer<typeof applicationSchema>;

