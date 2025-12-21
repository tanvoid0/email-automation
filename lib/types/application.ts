/**
 * Application data structure
 */
export interface ApplicationData {
  id: string;
  name: string; // Professor/recipient name
  university: string;
  email: string;
  emailText: string;
  status: "pending" | "sending" | "sent" | "error";
  error?: string;
  attachments?: string[]; // Array of attachment IDs
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Application form data (for form handling)
 */
export interface ApplicationFormData {
  name: string;
  university: string;
  email: string;
  emailText: string;
  attachments?: string[];
}

/**
 * Application creation request
 */
export interface CreateApplicationRequest {
  name: string;
  university: string;
  email: string;
  emailText: string;
  attachments?: string[];
  status?: "pending" | "sending" | "sent" | "error";
}

