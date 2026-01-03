/**
 * API response types
 * Shared between UI components and services
 */

/**
 * Generic API error response
 */
export interface ApiErrorResponse {
  error: string;
  message?: string;
}

/**
 * Generic API success response
 */
export interface ApiSuccessResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
}

/**
 * Email API response
 */
export interface EmailApiResponse {
  success: boolean;
  messageId?: string;
  mocked?: boolean;
  to?: string;
  error?: string;
}

/**
 * Process queue API request
 */
export interface ProcessQueueRequest {
  to: string;
  subject: string;
  text: string;
  attachmentIds?: string[];
  itemId?: string;
}

/**
 * Process queue API response
 */
export interface ProcessQueueResponse {
  success: boolean;
  messageId?: string;
  mocked?: boolean;
  itemId?: string;
  error?: string;
}

/**
 * Attachment API response
 */
export interface AttachmentApiResponse {
  _id: string;
  filename: string;
  contentType?: string;
  content: string;
  size?: number;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Profile API response
 */
export interface ProfileApiResponse {
  name: string;
  fullName: string;
  email: string;
  degree?: string;
  university?: string;
  gpa?: string;
}

