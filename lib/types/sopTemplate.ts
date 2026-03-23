/**
 * SOP Template related types
 */

export interface TemplateSection {
  key: string;
  label: string;
  placeholder?: string;
  order: number;
}

export interface SopTemplate {
  id: string;
  name: string;
  description?: string;
  sections: TemplateSection[];
}

export interface SopTemplateApiResponse {
  _id: string;
  name: string;
  description?: string;
  sections: TemplateSection[];
  createdAt?: string;
  updatedAt?: string;
}

export interface SopTemplateFormData {
  name: string;
  description?: string;
  sections: TemplateSection[];
}
