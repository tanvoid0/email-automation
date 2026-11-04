import type { SmtpProvider } from "@/lib/constants/smtpPresets";

export interface SmtpConfigData {
  provider: SmtpProvider;
  host?: string;
  port?: number;
  secure?: boolean;
  user?: string;
  pass?: string;
  from?: string;
}

/**
 * User profile data structure
 */
export interface UserProfileData {
  name: string; // Profile identifier — the account's username
  fullName: string; // User's full name
  email: string; // User's email address
  degree?: string; // User's degree
  university?: string; // User's university
  gpa?: string; // User's GPA
  smtp?: SmtpConfigData;
}

/**
 * User profile form data (for form handling)
 */
export interface UserProfileFormData {
  fullName: string;
  email: string;
  degree?: string;
  university?: string;
  gpa?: string;
}

/**
 * SMTP config form data. `pass` left blank means "keep the existing password".
 */
export interface SmtpConfigFormData {
  provider: SmtpProvider;
  host?: string;
  port?: number;
  secure?: boolean;
  user: string;
  pass?: string;
  from?: string;
}

/** What the SMTP config GET endpoint returns — the password itself is never sent back */
export interface SmtpConfigResponse {
  provider: SmtpProvider;
  host: string;
  port: number | "";
  secure: boolean;
  user: string;
  from: string;
  hasPassword: boolean;
}

