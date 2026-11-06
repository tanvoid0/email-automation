"use client";

import { useRouter } from "next/navigation";
import { useToast } from "@/lib/hooks/useToast";
import { EmailForm } from "@/app/components/EmailForm";
import { PageHeader } from "@/app/components/PageHeader";
import type { UserProfileData } from "@/lib/types/userProfile";

export default function NewApplicationPage() {
  const toast = useToast();
  const router = useRouter();

  const handleCustomizeEmail = async (
    baseTemplate: string,
    professorName: string,
    universityName: string
  ): Promise<string> => {
    try {
      const response = await fetch("/api/gemini", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          baseTemplate,
          professorName,
          universityName,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to customize email");
      }

      const data = await response.json();
      return data.customizedText;
    } catch (error: any) {
      throw error;
    }
  };

  const handleAddApplication = async (applicationData: {
    name: string;
    university: string;
    email: string;
    baseTemplate: string;
    attachments?: Array<{
      filename: string;
      content: string;
      contentType?: string;
    } | string>; // Can be attachment objects or IDs
  }) => {
    try {
      // Validate required fields
      if (!applicationData.name || !applicationData.university || !applicationData.email || !applicationData.baseTemplate) {
        throw new Error("Missing required fields: name, university, email, and emailText are required");
      }

      const requestBody = {
        name: applicationData.name.trim(),
        university: applicationData.university.trim(),
        email: applicationData.email.trim(),
        emailText: applicationData.baseTemplate.trim(),
        attachments: applicationData.attachments || [],
      };

      // Validate emailText length (must be at least 10 characters per schema)
      if (requestBody.emailText.length < 10) {
        throw new Error("Email text must be at least 10 characters long");
      }

      const response = await fetch("/api/applications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const error: { error?: string; details?: Record<string, string> } = await response.json();
        const errorMessage = error.details 
          ? `Validation failed: ${JSON.stringify(error.details)}`
          : error.error || "Failed to add application";
        
        // Check if it's a validation error that might be related to missing profile
        if (errorMessage.includes("required") || errorMessage.includes("missing")) {
          throw new Error("PROFILE_REQUIRED");
        }
        
        throw new Error(errorMessage);
      }

      toast.success("Application added successfully!", {
        id: "application-added",
        duration: 3000,
        persist: false,
      });
      router.push("/applications");
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      
      // Check if error is related to missing user profile
      if (err.message === "PROFILE_REQUIRED" || err.message.includes("profile") || err.message.includes("user") || err.message.includes("required")) {
        toast.error("User profile required", {
          description: "Please set up your personal information (name and email) in settings before creating applications. This information is used to personalize your emails and replace placeholders like [YOUR_NAME] and [YOUR_EMAIL].",
          action: {
            label: "Go to Settings",
            onClick: () => router.push("/settings"),
          },
          duration: 10000,
        });
      } else {
        toast.error(`Error adding application: ${err.message}`, {
          description: "Please check that all required fields are filled correctly.",
          duration: 5000,
        });
      }
      throw error;
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-8">
      <PageHeader
        title="Add Application"
        description="Create a new application and customize the email template"
        backHref="/applications"
      />

      <EmailForm
        onAddApplication={handleAddApplication}
        onCustomizeEmail={handleCustomizeEmail}
      />
    </div>
  );
}
