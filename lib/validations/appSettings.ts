import { z } from "zod";

/** Both fields optional; empty string clears the stored value when the key is present. */
export const admissionSettingsPatchSchema = z.object({
  admissionLevel: z.string().optional(),
  admissionSubjectArea: z.string().optional(),
});

export type AdmissionSettingsPatch = z.infer<typeof admissionSettingsPatchSchema>;
