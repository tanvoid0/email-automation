/**
 * Replaces placeholders in email template with actual values
 */
export function replaceTemplatePlaceholders(
  template: string,
  values: {
    professorName: string;
    professorEmail: string;
    universityName: string;
    yourName?: string;
    yourEmail?: string;
    yourDegree?: string;
    yourUniversity?: string;
    yourGPA?: string;
  }
): string {
  let result = template;

  // Replace all placeholder variations (case-insensitive)
  const placeholders = [
    { pattern: /\[PROFESSOR_NAME\]/gi, value: values.professorName },
    { pattern: /\[PROFESSOR_EMAIL\]/gi, value: values.professorEmail },
    { pattern: /\[UNIVERSITY_NAME\]/gi, value: values.universityName },
    { pattern: /\[YOUR_NAME\]/gi, value: values.yourName || "" },
    { pattern: /\[YOUR_EMAIL\]/gi, value: values.yourEmail || "" },
    { pattern: /\[YOUR_DEGREE\]/gi, value: values.yourDegree || "" },
    { pattern: /\[YOUR_UNIVERSITY\]/gi, value: values.yourUniversity || "" },
    { pattern: /\[YOUR_GPA\]/gi, value: values.yourGPA || "" },
    // Support legacy [Name] placeholder for backward compatibility
    { pattern: /\[Name\]/g, value: values.professorName },
  ];

  placeholders.forEach(({ pattern, value }) => {
    result = result.replace(pattern, value);
  });

  return result;
}

