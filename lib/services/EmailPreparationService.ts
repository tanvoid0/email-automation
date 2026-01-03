/**
 * Email Preparation Service
 * Handles email template processing, placeholder replacement, and attachment merging
 */

import { replaceTemplatePlaceholders } from "@/lib/utils/template";
import type { TemplatePlaceholderValues, TemplateApiResponse } from "@/lib/types/template";
import type { UserProfileData } from "@/lib/types/userProfile";
import type { ProfileApiResponse } from "@/lib/types/api";

export interface ApplicationData {
  id: string;
  name: string;
  university: string;
  email: string;
  emailText: string;
  attachmentIds?: string[];
}

export interface PreparedEmail {
  to: string;
  subject: string;
  text: string;
  attachmentIds: string[];
  applicationId: string;
  applicationName: string;
}

export interface TemplateData {
  subject: string;
  attachmentIds: string[];
}

export class EmailPreparationService {
  private static readonly DEFAULT_SUBJECT = "Request for Admission Acceptance Letter for Master's Program";

  /**
   * Load user profile from API
   */
  static async loadUserProfile(): Promise<UserProfileData | null> {
    try {
      const response = await fetch("/api/profile");
      if (response.ok) {
        const profileData: ProfileApiResponse = await response.json();
        return {
          name: profileData.name,
          fullName: profileData.fullName,
          email: profileData.email,
          degree: profileData.degree,
          university: profileData.university,
          gpa: profileData.gpa,
        };
      }
    } catch (error) {
      console.warn("[EmailPreparationService] Failed to load user profile:", error);
    }
    return null;
  }

  /**
   * Type guard for valid MongoDB ObjectId string
   */
  private static isValidObjectId(id: unknown): id is string {
    return typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id.trim());
  }

  /**
   * Load email template from API
   */
  static async loadTemplate(): Promise<TemplateData> {
    try {
      const response = await fetch("/api/template");
      if (response.ok) {
        const templateData: TemplateApiResponse = await response.json();
        const attachmentIds = Array.isArray(templateData.attachments)
          ? templateData.attachments.filter(this.isValidObjectId)
          : [];
        
        return {
          subject: templateData.subject || this.DEFAULT_SUBJECT,
          attachmentIds,
        };
      }
    } catch (error) {
      console.warn("[EmailPreparationService] Failed to load template:", error);
    }
    return {
      subject: this.DEFAULT_SUBJECT,
      attachmentIds: [],
    };
  }

  /**
   * Build placeholder values from application and user profile
   */
  static buildPlaceholderValues(
    application: ApplicationData,
    userProfile: UserProfileData | null
  ): TemplatePlaceholderValues {
    const values: TemplatePlaceholderValues = {
      professorName: application.name,
      professorEmail: application.email,
      universityName: application.university,
    };

    if (userProfile) {
      values.fullName = userProfile.fullName;
      values.email = userProfile.email;
      values.degree = userProfile.degree;
      values.university = userProfile.university;
      values.gpa = userProfile.gpa;
    }

    return values;
  }

  /**
   * Replace placeholders in email text
   */
  static replacePlaceholders(
    text: string,
    application: ApplicationData,
    userProfile: UserProfileData | null
  ): string {
    const values = this.buildPlaceholderValues(application, userProfile);
    return replaceTemplatePlaceholders(text, values);
  }

  /**
   * Merge attachment IDs from template and application
   */
  static mergeAttachmentIds(
    templateAttachmentIds: string[],
    applicationAttachmentIds: string[] = []
  ): string[] {
    return Array.from(
      new Set([
        ...templateAttachmentIds,
        ...applicationAttachmentIds.filter(this.isValidObjectId),
      ])
    );
  }

  /**
   * Prepare a single email for sending
   */
  static prepareEmail(
    application: ApplicationData,
    template: TemplateData,
    userProfile: UserProfileData | null
  ): PreparedEmail {
    // Replace placeholders in email text
    const finalEmailText = this.replacePlaceholders(
      application.emailText,
      application,
      userProfile
    );

    // Replace placeholders in subject
    const subject = this.replacePlaceholders(
      template.subject,
      application,
      userProfile
    );

    // Merge attachment IDs
    const allAttachmentIds = this.mergeAttachmentIds(
      template.attachmentIds,
      application.attachmentIds
    );

    return {
      to: application.email,
      subject,
      text: finalEmailText,
      attachmentIds: allAttachmentIds,
      applicationId: application.id,
      applicationName: application.name,
    };
  }

  /**
   * Prepare multiple emails for sending (loads profile and template once)
   */
  static async prepareEmails(
    applications: ApplicationData[]
  ): Promise<PreparedEmail[]> {
    // Load profile and template once for all emails
    const [userProfile, template] = await Promise.all([
      this.loadUserProfile(),
      this.loadTemplate(),
    ]);

    // Prepare each email
    return applications.map((application) =>
      this.prepareEmail(application, template, userProfile)
    );
  }
}

