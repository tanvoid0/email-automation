import type { TemplatePlaceholderValues } from "@/lib/types/template";

/**
 * Replaces placeholders in email template with actual values
 */
export function replaceTemplatePlaceholders(
  template: string,
  values: TemplatePlaceholderValues
): string {
  let result = template;

  // Replace all placeholder variations (case-insensitive)
  const placeholders = [
    { pattern: /\[PROFESSOR_NAME\]/gi, value: values.professorName },
    { pattern: /\[PROFESSOR_EMAIL\]/gi, value: values.professorEmail },
    { pattern: /\[UNIVERSITY_NAME\]/gi, value: values.universityName },
    { pattern: /\[YOUR_NAME\]/gi, value: values.fullName || "" },
    { pattern: /\[YOUR_EMAIL\]/gi, value: values.email || "" },
    { pattern: /\[YOUR_DEGREE\]/gi, value: values.degree || "" },
    { pattern: /\[YOUR_UNIVERSITY\]/gi, value: values.university || "" },
    { pattern: /\[YOUR_GPA\]/gi, value: values.gpa || "" },
    // Support legacy [Name] placeholder for backward compatibility
    { pattern: /\[Name\]/g, value: values.professorName },
  ];

  placeholders.forEach(({ pattern, value }) => {
    result = result.replace(pattern, value);
  });

  return result;
}

