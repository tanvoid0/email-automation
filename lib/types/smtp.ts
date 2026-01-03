/**
 * SMTP-related types
 */

export interface EmailAttachment {
  filename: string;
  path?: string;
  content?: string | Buffer;
  contentType?: string;
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  attachments?: EmailAttachment[];
}

export interface SendEmailResult {
  success: boolean;
  messageId: string;
}

