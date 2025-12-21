/**
 * Attachment data structure
 */
export interface AttachmentData {
  id: string;
  filename: string;
  content: string; // Base64 encoded content
  contentType?: string;
  size?: number;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Attachment creation request
 */
export interface CreateAttachmentRequest {
  filename: string;
  content: string; // Base64 encoded content
  contentType?: string;
  size?: number;
}

