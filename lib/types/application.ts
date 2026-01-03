/**
 * Application-related types
 * Shared between UI components and services
 */

export type ApplicationStatus = "pending" | "sending" | "sent" | "error" | "cancelled";

export interface Application {
  id: string;
  name: string;
  university: string;
  email: string;
  emailText: string;
  status: ApplicationStatus;
  error?: string;
  attachments?: ApplicationAttachment[];
  attachmentIds?: string[];
}

export interface ApplicationAttachment {
  id?: string;
  filename: string;
  content: string;
  contentType?: string;
}

/**
 * Application data from API (MongoDB format)
 */
export interface ApplicationApiResponse {
  _id: string;
  name: string;
  university: string;
  email: string;
  emailText: string;
  status?: ApplicationStatus;
  error?: string;
  attachments?: string[]; // Array of attachment IDs
}

/**
 * Application form data
 */
export interface ApplicationFormData {
  name: string;
  university: string;
  email: string;
  emailText: string;
  attachments?: (string | ApplicationAttachment)[];
}

/**
 * Application update payload
 */
export interface ApplicationUpdatePayload {
  name?: string;
  university?: string;
  email?: string;
  emailText?: string;
  status?: ApplicationStatus;
  error?: string;
  errorDetails?: ErrorDetails;
}

/**
 * Error details for application errors
 */
export interface ErrorDetails {
  message: string;
  payloadSize?: {
    emailBodySizeKB: number;
    attachmentIdsCount: number;
    requestPayloadSizeKB: number;
    attachmentIds: string[];
  };
  timestamp: string;
  httpStatus?: number;
  httpStatusText?: string;
  recipient?: string;
  recipientEmail?: string;
  subject?: string;
  emailBodyPreview?: string;
}
