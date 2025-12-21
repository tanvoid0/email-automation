"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ApplicationList, type Application } from "./components/ApplicationList";
import { Plus, Settings, Mail, Loader2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default function Home() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [bulkSendProgress, setBulkSendProgress] = useState<{
    total: number;
    sent: number;
    inProgress: boolean;
  } | null>(null);

  // Helper function for fetch with timeout
  const fetchWithTimeout = async (url: string, options: RequestInit, timeoutMs: number = 30000) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout after ${timeoutMs}ms. The email server may be slow or unreachable.`);
      }
      throw error;
    }
  };

  // Load applications from MongoDB on mount
  useEffect(() => {
    loadApplications();
  }, []);

  const loadApplications = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/applications");
      if (!response.ok) {
        throw new Error("Failed to load applications");
      }
      const data = await response.json();
      console.log("[Home] Loaded applications from API:", {
        count: data.length,
        applicationsWithAttachments: data.filter((p: any) => p.attachments && p.attachments.length > 0).length,
      });
      
      // Fetch all attachment IDs from all applications
      const allAttachmentIds = new Set<string>();
      data.forEach((p: any) => {
        if (p.attachments && Array.isArray(p.attachments)) {
          p.attachments.forEach((id: string) => allAttachmentIds.add(id));
        }
      });

      // Fetch all attachments in batch
      let attachmentsMap = new Map<string, any>();
      if (allAttachmentIds.size > 0) {
        try {
          const attachmentsResponse = await fetch("/api/attachments/batch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids: Array.from(allAttachmentIds) }),
          });
          if (attachmentsResponse.ok) {
            const attachments = await attachmentsResponse.json();
            attachments.forEach((att: any) => {
              attachmentsMap.set(att._id, att);
            });
          }
        } catch (error) {
          console.warn("Failed to fetch attachments:", error);
        }
      }
      
      // Convert MongoDB documents to Application format
      const formattedApplications: Application[] = data.map((p: any) => {
        // Convert attachment IDs to attachment objects for display
        const attachmentObjects = (p.attachments || [])
          .map((id: string) => attachmentsMap.get(id))
          .filter((att: any) => att !== undefined)
          .map((att: any) => ({
            id: att._id,
            filename: att.filename,
            content: att.content,
            contentType: att.contentType,
          }));

        const application = {
          id: p._id,
          name: p.name,
          university: p.university,
          email: p.email,
          emailText: p.emailText,
          status: p.status || "pending",
          error: p.error,
          attachments: attachmentObjects,
          attachmentIds: p.attachments || [], // Keep IDs for API calls
        };
        
        if (application.attachments.length > 0) {
          console.log("[Home] Application with attachments:", {
            name: application.name,
            attachmentsCount: application.attachments.length,
            attachments: application.attachments.map((a: any) => a.filename),
          });
        }
        
        return application;
      });
      setApplications(formattedApplications);
    } catch (error: any) {
      console.error("Error loading applications:", error);
      toast.error(`Error loading applications: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };


  const updateApplicationStatus = async (
    id: string,
    status: Application["status"],
    error?: string
  ) => {
    try {
      const response = await fetch(`/api/applications/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status, error }),
      });

      if (!response.ok) {
        throw new Error("Failed to update application status");
      }

      return await response.json();
    } catch (error: any) {
      console.error("Error updating application status:", error);
    }
  };

  const handleSendEmail = async (application: Application) => {
    // Update status to sending
    setApplications(
      applications.map((p) =>
        p.id === application.id ? { ...p, status: "sending" as const } : p
      )
    );
    await updateApplicationStatus(application.id, "sending");

    try {
      // Load user profile to replace any remaining placeholders
      let userProfile = null;
      try {
        const profileResponse = await fetch("/api/profile");
        if (profileResponse.ok) {
          userProfile = await profileResponse.json();
        }
      } catch (error) {
        console.warn("Failed to load user profile for email sending");
      }

      // Load template to get subject and attachments
      let templateSubject = null;
      let templateAttachments: any[] = [];
      try {
        const templateResponse = await fetch("/api/template");
        if (templateResponse.ok) {
          const templateData = await templateResponse.json();
          templateSubject = templateData.subject;
          templateAttachments = templateData.attachments || [];
        }
      } catch (error) {
        console.warn("Failed to load template for email sending");
      }

      // Replace any remaining placeholders in email text
      let finalEmailText = application.emailText;
      if (userProfile) {
        const { replaceTemplatePlaceholders } = await import("@/lib/utils/template");
        finalEmailText = replaceTemplatePlaceholders(finalEmailText, {
          professorName: application.name,
          professorEmail: application.email,
          universityName: application.university,
          fullName: userProfile.fullName,
          email: userProfile.email,
          degree: userProfile.degree,
          university: userProfile.university,
          gpa: userProfile.gpa,
        });
      }

      // Get subject from template or use fallback
      let subject = templateSubject || "Request for Admission Acceptance Letter for Master's Program";
      
      // Replace placeholders in subject if needed
      if (userProfile) {
        const { replaceTemplatePlaceholders } = await import("@/lib/utils/template");
        subject = replaceTemplatePlaceholders(subject, {
          professorName: application.name,
          professorEmail: application.email,
          universityName: application.university,
          fullName: userProfile.fullName,
          email: userProfile.email,
          degree: userProfile.degree,
          university: userProfile.university,
          gpa: userProfile.gpa,
        });
      } else {
        // Replace basic placeholders even without profile
        const { replaceTemplatePlaceholders } = await import("@/lib/utils/template");
        subject = replaceTemplatePlaceholders(subject, {
          professorName: application.name,
          professorEmail: application.email,
          universityName: application.university,
        });
      }

      // Fetch application attachments by ID
      let applicationAttachments: any[] = [];
      if (application.attachmentIds && application.attachmentIds.length > 0) {
        try {
          const attachmentsResponse = await fetch("/api/attachments/batch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids: application.attachmentIds }),
          });
          if (attachmentsResponse.ok) {
            applicationAttachments = await attachmentsResponse.json();
          }
        } catch (error) {
          console.warn("Failed to fetch application attachments:", error);
        }
      }

      // Merge template attachments with application-specific attachments
      const allAttachments = [
        ...(templateAttachments || []),
        ...applicationAttachments.map(att => ({
          filename: att.filename,
          content: att.content,
          contentType: att.contentType,
        })),
      ];

      const response = await fetchWithTimeout(
        "/api/email",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            to: application.email,
            subject,
            text: finalEmailText,
            attachments: allAttachments.length > 0 ? allAttachments : undefined,
          }),
        },
        30000 // 30 second timeout
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to send email");
      }

      // Update status to sent
      setApplications(
        applications.map((p) =>
          p.id === application.id ? { ...p, status: "sent" as const, error: undefined } : p
        )
      );
      await updateApplicationStatus(application.id, "sent");
      toast.success(`Email sent to ${application.name}`);
    } catch (error: any) {
      // Update status to error
      setApplications(
        applications.map((p) =>
          p.id === application.id
            ? { ...p, status: "error" as const, error: error.message }
            : p
        )
      );
      await updateApplicationStatus(application.id, "error", error.message);
      toast.error(`Failed to send email to ${application.name}: ${error.message}`);
    }
  };

  const handleBulkSend = async (applicationIds: string[]) => {
    const applicationsToSend = applications.filter((p) => applicationIds.includes(p.id));
    const total = applicationsToSend.length;

    // Initialize progress tracking
    setBulkSendProgress({ total, sent: 0, inProgress: true });

    // Update all to sending
    for (const application of applicationsToSend) {
      setApplications((prev) =>
        prev.map((p) =>
          p.id === application.id ? { ...p, status: "sending" as const } : p
        )
      );
      await updateApplicationStatus(application.id, "sending");
    }

    // Load user profile once for all emails
    let userProfile = null;
    try {
      const profileResponse = await fetch("/api/profile");
      if (profileResponse.ok) {
        userProfile = await profileResponse.json();
      }
    } catch (error) {
      console.warn("Failed to load user profile for email sending");
    }

    // Load template once for all emails to get subject and attachments
    let templateSubject = null;
    let templateAttachments: any[] = [];
    try {
      const templateResponse = await fetch("/api/template");
      if (templateResponse.ok) {
        const templateData = await templateResponse.json();
        templateSubject = templateData.subject;
        templateAttachments = templateData.attachments || [];
      }
    } catch (error) {
      console.warn("Failed to load template for email sending");
    }

    let sentCount = 0;
    let successCount = 0;

    // Send emails sequentially to avoid overwhelming the SMTP server
    for (const application of applicationsToSend) {
      try {
        // Replace any remaining placeholders in email text
        let finalEmailText = application.emailText;
        if (userProfile) {
          const { replaceTemplatePlaceholders } = await import("@/lib/utils/template");
          finalEmailText = replaceTemplatePlaceholders(finalEmailText, {
            professorName: application.name,
            professorEmail: application.email,
            universityName: application.university,
            fullName: userProfile.fullName,
            email: userProfile.email,
            degree: userProfile.degree,
            university: userProfile.university,
            gpa: userProfile.gpa,
          });
        }

        // Get subject from template or use fallback
        let subject = templateSubject || "Request for Admission Acceptance Letter for Master's Program";
        
        // Replace placeholders in subject if needed
        if (userProfile) {
          const { replaceTemplatePlaceholders } = await import("@/lib/utils/template");
          subject = replaceTemplatePlaceholders(subject, {
            professorName: application.name,
            professorEmail: application.email,
            universityName: application.university,
            fullName: userProfile.fullName,
            email: userProfile.email,
            degree: userProfile.degree,
            university: userProfile.university,
            gpa: userProfile.gpa,
          });
        } else {
          // Replace basic placeholders even without profile
          const { replaceTemplatePlaceholders } = await import("@/lib/utils/template");
          subject = replaceTemplatePlaceholders(subject, {
            professorName: application.name,
            professorEmail: application.email,
            universityName: application.university,
          });
        }

        // Fetch application attachments by ID
        let applicationAttachments: any[] = [];
        if (application.attachmentIds && application.attachmentIds.length > 0) {
          try {
            const attachmentsResponse = await fetch("/api/attachments/batch", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ids: application.attachmentIds }),
            });
            if (attachmentsResponse.ok) {
              applicationAttachments = await attachmentsResponse.json();
            }
          } catch (error) {
            console.warn("Failed to fetch application attachments:", error);
          }
        }

        // Merge template attachments with application-specific attachments
        const allAttachments = [
          ...(templateAttachments || []),
          ...applicationAttachments.map(att => ({
            filename: att.filename,
            content: att.content,
            contentType: att.contentType,
          })),
        ];

        const response = await fetchWithTimeout(
          "/api/email",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              to: application.email,
              subject,
              text: finalEmailText,
              attachments: allAttachments.length > 0 ? allAttachments : undefined,
            }),
          },
          30000 // 30 second timeout
        );

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to send email");
        }

        // Update status to sent
        sentCount++;
        successCount++;
        setBulkSendProgress({ total, sent: sentCount, inProgress: true });
        setApplications((prev) =>
          prev.map((p) =>
            p.id === application.id
              ? { ...p, status: "sent" as const, error: undefined }
              : p
          )
        );
        await updateApplicationStatus(application.id, "sent");
      } catch (error: any) {
        // Update status to error (but still count as processed)
        sentCount++;
        setBulkSendProgress({ total, sent: sentCount, inProgress: true });
        setApplications((prev) =>
          prev.map((p) =>
            p.id === application.id
              ? { ...p, status: "error" as const, error: error.message }
              : p
          )
        );
        await updateApplicationStatus(application.id, "error", error.message);
      }

      // Small delay between emails
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // Update progress to completed
    setBulkSendProgress({ total, sent: sentCount, inProgress: false });
    
    // Show completion toast
    if (successCount === total) {
      toast.success(`All ${total} email(s) sent successfully!`);
    } else {
      toast.warning(`${successCount} of ${total} email(s) sent successfully. ${total - successCount} failed.`);
    }

    // Clear progress after a delay
    setTimeout(() => {
      setBulkSendProgress(null);
    }, 3000);
  };


  const handleUpdateApplication = async (
    id: string,
    applicationData: {
      name: string;
      university: string;
      email: string;
      baseTemplate: string;
    }
  ) => {
    try {
      const response = await fetch(`/api/applications/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: applicationData.name,
          university: applicationData.university,
          email: applicationData.email,
          emailText: applicationData.baseTemplate,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update application");
      }

      const updatedApplication = await response.json();
      
      // Update in local state
      const formattedApplication: Application = {
        id: updatedApplication._id,
        name: updatedApplication.name,
        university: updatedApplication.university,
        email: updatedApplication.email,
        emailText: updatedApplication.emailText,
        status: updatedApplication.status || "pending",
        error: updatedApplication.error,
        attachments: updatedApplication.attachments || [],
      };
      
      setApplications(
        applications.map((p) => (p.id === id ? formattedApplication : p))
      );
    } catch (error: any) {
      toast.error(`Error updating application: ${error.message}`);
      throw error;
    }
  };

  const handleRemove = async (id: string) => {
    try {
      const response = await fetch(`/api/applications/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete application");
      }

      setApplications(applications.filter((p) => p.id !== id));
      toast.success("Application removed successfully");
    } catch (error: any) {
      toast.error(`Error removing application: ${error.message}`);
    }
  };

  if (isLoading) {
    return (
      <main className="min-h-screen bg-background p-4 md:p-8">
        <div className="max-w-7xl mx-auto flex flex-col items-center justify-center h-64 gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground font-medium">Loading applications...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-4 md:space-y-6">
            <div className="mb-6 md:mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-1 md:mb-2">Email Automation</h1>
                <p className="text-sm sm:text-base text-muted-foreground">
                  Automate personalized emails using AI
                </p>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <Link href="/applications/new" className="w-full sm:w-auto">
                  <Button className="w-full sm:w-auto bg-primary hover:bg-primary/90">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Application
                  </Button>
                </Link>
                <Link href="/settings" className="w-full sm:w-auto">
                  <Button variant="outline" className="w-full sm:w-auto">
                    <Settings className="h-4 w-4 mr-2" />
                    Settings
                  </Button>
                </Link>
              </div>
            </div>

        <ApplicationList
          applications={applications}
          onSendEmail={handleSendEmail}
          onBulkSend={handleBulkSend}
          onRemove={handleRemove}
          bulkSendProgress={bulkSendProgress}
        />
      </div>
    </main>
  );
}
