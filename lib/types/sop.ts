/**
 * SOP (Statement of Purpose) related types
 */

export interface SOPSectionEntry {
  key: string;
  content: string;
}

export interface SOP {
  id: string;
  title: string;
  content: string;
  applicationId?: string;
  admissionApplicationId?: string;
  templateId?: string;
  sections?: SOPSectionEntry[];
}

/**
 * SOP data from API (MongoDB format)
 */
export interface SOPApiResponse {
  _id: string;
  title: string;
  content: string;
  applicationId?: string;
  admissionApplicationId?: string;
  templateId?: string;
  sections?: SOPSectionEntry[];
  createdAt?: string;
  updatedAt?: string;
}

/**
 * SOP with optional populated application info for list display
 */
export interface SOPWithApplication extends SOPApiResponse {
  application?: {
    _id: string;
    name: string;
    university: string;
  };
}

/**
 * SOP form data (create/update)
 */
export interface SOPFormData {
  title: string;
  content: string;
  applicationId?: string;
  admissionApplicationId?: string;
  templateId?: string;
  sections?: SOPSectionEntry[];
}
