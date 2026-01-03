/**
 * Template-related types
 * Shared between UI components and services
 */

export interface TemplatePlaceholderValues {
  professorName: string;
  professorEmail: string;
  universityName: string;
  fullName?: string;
  email?: string;
  degree?: string;
  university?: string;
  gpa?: string;
}

/**
 * Template API response
 */
export interface TemplateApiResponse {
  content: string;
  description?: string;
  subject?: string;
  attachments?: string[]; // Array of attachment IDs
}

/**
 * Template data structure
 */
export interface TemplateData {
  content: string;
  description?: string;
  subject: string;
  attachmentIds: string[];
}
