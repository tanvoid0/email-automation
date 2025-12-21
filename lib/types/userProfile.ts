/**
 * User profile data structure
 */
export interface UserProfileData {
  name: string; // Profile identifier (usually "default")
  fullName: string; // User's full name
  email: string; // User's email address
  degree?: string; // User's degree
  university?: string; // User's university
  gpa?: string; // User's GPA
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

