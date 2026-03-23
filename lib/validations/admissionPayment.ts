import { z } from "zod";
import { ADMISSION_PAYMENT_STATUSES } from "@/lib/types/admissionPayment";

const optionalUrl = z.string().url().optional().or(z.literal("").transform(() => undefined));

export const admissionPaymentCreateSchema = z.object({
  label: z.string().min(1).max(200).optional(),
  amountText: z
    .string()
    .optional()
    .transform((s) => (s?.trim() ? s.trim() : undefined)),
  amountValue: z.number().finite().optional(),
  currency: z
    .string()
    .optional()
    .transform((s) => (s?.trim() ? s.trim() : undefined)),
  paymentUrl: optionalUrl,
  note: z.string().optional(),
  status: z.enum(ADMISSION_PAYMENT_STATUSES).optional(),
  paidAt: z
    .string()
    .optional()
    .transform((s) => (s?.trim() ? s.trim() : undefined)),
});

export const admissionPaymentUpdateSchema = admissionPaymentCreateSchema.partial();

export type AdmissionPaymentCreateInput = z.infer<typeof admissionPaymentCreateSchema>;
export type AdmissionPaymentUpdateInput = z.infer<typeof admissionPaymentUpdateSchema>;
