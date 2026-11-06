/** Response item of GET /api/attachments/with-references. */
export interface AttachmentWithUsage {
  _id: string;
  filename: string;
  contentType?: string;
  size?: number;
  createdAt?: string;
  /** Outreach emails (kind email_outreach) that attach this file. */
  outreach: Array<{ id: string; name: string; email: string }>;
  /** University admission applications that attach this file. */
  admissions: Array<{ id: string; label: string }>;
  /** Attached by default to every new outreach email (account's email template). */
  inTemplate: boolean;
  referenceCount: number;
}
