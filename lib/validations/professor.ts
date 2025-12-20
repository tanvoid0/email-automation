import { z } from "zod";

export const professorSchema = z.object({
  name: z
    .string()
    .min(1, "Professor name is required")
    .min(2, "Professor name must be at least 2 characters"),
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
});

export type ProfessorFormData = z.infer<typeof professorSchema>;

