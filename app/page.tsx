"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useToast } from "@/lib/hooks/useToast";
import { useEmailQueue } from "@/lib/hooks/useEmailQueue";
import { Button } from "@/components/ui/button";
import { ApplicationList, type Application } from "./components/ApplicationList";
import { EmailProgress } from "./components/EmailProgress";
import { Plus, Settings, Mail, Loader2, Paperclip } from "lucide-react";
import { NotificationBell } from "./components/NotificationBell";
import { EmailPreparationService } from "@/lib/services/EmailPreparationService";
import { ApplicationStatusService } from "@/lib/services/ApplicationStatusService";
import type { EmailQueueItem } from "@/lib/utils/email-queue";
import type { ApplicationApiResponse, ApplicationAttachment, ErrorDetails } from "@/lib/types/application";
import type { AttachmentApiResponse, ApiErrorResponse } from "@/lib/types/api";
import { getErrorMessage } from "@/lib/types/errors";

export const dynamic = "force-dynamic";

export default function Home() {
  const toast = useToast();
  const [applications, setApplications] = useState<Application[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const emailQueue = useEmailQueue();

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
    } catch (error: unknown) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timeout after ${timeoutMs}ms. The email server may be slow or unreachable.`);
      }
      throw error;
    }
  };

  // Helper function to safely parse error responses
  const parseErrorResponse = async (response: Response): Promise<string> => {
    const contentType = response.headers.get("content-type");
    
    // Check if response is JSON
    if (contentType && contentType.includes("application/json")) {
      try {
        const error = await response.json();
        return error.error || error.message || `HTTP ${response.status}: ${response.statusText}`;
      } catch (parseError) {
        // If JSON parsing fails, fall through to text parsing
      }
    }
    
    // Try to parse as text
    try {
      const text = await response.text();
      // If text is too long or looks like HTML, provide a generic message
      if (text.length > 200 || text.trim().startsWith("<!DOCTYPE") || text.trim().startsWith("<html")) {
        return `HTTP ${response.status}: ${response.statusText || "Server error"}`;
      }
      return text || `HTTP ${response.status}: ${response.statusText || "Server error"}`;
    } catch (textError) {
      // If text parsing also fails, return a generic error
      return `HTTP ${response.status}: ${response.statusText || "Unknown error"}`;
    }
  };

  // Load applications from MongoDB on mount
  useEffect(() => {
    loadApplications();
  }, []);

  // Sync queue status with applications
  useEffect(() => {
    const syncQueueWithApplications = () => {
      const queue = emailQueue.queue;
      if (!queue || queue.items.length === 0) return;

      // Update application statuses based on queue items
      setApplications((prev) =>
        prev.map((app) => {
          const queueItem = queue.items.find((item) => item.applicationId === app.id);
          if (queueItem) {
            let newStatus: Application["status"] = app.status;
            if (queueItem.status === "sent") {
              newStatus = "sent";
            } else if (queueItem.status === "error") {
              newStatus = "error";
            } else if (queueItem.status === "processing" || queueItem.status === "sending") {
              newStatus = "sending";
            }

            // Update status in database if changed
            if (newStatus !== app.status) {
              updateApplicationStatus(app.id, newStatus, queueItem.error).catch(console.error);
            }

            return {
              ...app,
              status: newStatus,
              error: queueItem.error,
            };
          }
          return app;
        })
      );
    };

    // Sync periodically
    const interval = setInterval(syncQueueWithApplications, 2000);
    syncQueueWithApplications(); // Initial sync

    return () => clearInterval(interval);
  }, [emailQueue.queue, emailQueue.progress]);

  const loadApplications = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/applications");
      if (!response.ok) {
        throw new Error("Failed to load applications");
      }
      const data: ApplicationApiResponse[] = await response.json();
      console.log("[Home] Loaded applications from API:", {
        count: data.length,
        applicationsWithAttachments: data.filter((p) => p.attachments && p.attachments.length > 0).length,
      });
      
      // Fetch all attachment IDs from all applications
      const allAttachmentIds = new Set<string>();
      data.forEach((p) => {
        if (p.attachments && Array.isArray(p.attachments)) {
          p.attachments.forEach((id: string) => allAttachmentIds.add(id));
        }
      });

      // Fetch all attachments in batch
      const attachmentsMap = new Map<string, AttachmentApiResponse>();
      if (allAttachmentIds.size > 0) {
        try {
          const attachmentsResponse = await fetch("/api/attachments/batch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids: Array.from(allAttachmentIds) }),
          });
          if (attachmentsResponse.ok) {
            const attachments: AttachmentApiResponse[] = await attachmentsResponse.json();
            attachments.forEach((att) => {
              attachmentsMap.set(att._id, att);
            });
          }
        } catch (error) {
          console.warn("Failed to fetch attachments:", error);
        }
      }
      
      // Convert MongoDB documents to Application format
      const formattedApplications: Application[] = data.map((p) => {
        // Convert attachment IDs to attachment objects for display
        const attachmentObjects: ApplicationAttachment[] = (p.attachments || [])
          .map((id: string) => attachmentsMap.get(id))
          .filter((att): att is AttachmentApiResponse => att !== undefined)
          .map((att) => ({
            id: att._id,
            filename: att.filename,
            content: att.content,
            contentType: att.contentType,
          }));

        const application: Application = {
          id: p._id,
          name: p.name,
          university: p.university,
          email: p.email,
          emailText: p.emailText,
          status: (p.status || "pending") as Application["status"],
          error: p.error,
          attachments: attachmentObjects,
          attachmentIds: p.attachments || [], // Keep IDs for API calls
        };
        
        if (application.attachments && application.attachments.length > 0) {
          console.log("[Home] Application with attachments:", {
            name: application.name,
            attachmentsCount: application.attachments.length,
            attachments: application.attachments.map((a) => a.filename),
          });
        }
        
        return application;
      });
      setApplications(formattedApplications);
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      console.error("Error loading applications:", errorMessage);
      toast.error(`Error loading applications: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };


  const updateApplicationStatus = async (
    id: string,
    status: Application["status"],
    error?: string,
    errorDetails?: ErrorDetails
  ) => {
    try {
      await ApplicationStatusService.updateStatus(id, status, { error, errorDetails });
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      console.error("Error updating application status:", errorMessage);
    }
  };

  // Helper function to prepare email items for queue
  const prepareEmailItems = async (
    applicationsToSend: Application[]
  ): Promise<Omit<EmailQueueItem, 'id' | 'status' | 'createdAt'>[]> => {
    // Convert Application to ApplicationData format
    const applicationsData = applicationsToSend.map((app) => ({
      id: app.id,
      name: app.name,
      university: app.university,
      email: app.email,
      emailText: app.emailText,
      attachmentIds: app.attachmentIds || [],
    }));

    // Use service to prepare emails
    const preparedEmails = await EmailPreparationService.prepareEmails(applicationsData);

    // Convert to queue item format
    return preparedEmails.map((email) => ({
      applicationId: email.applicationId,
      applicationName: email.applicationName,
      email: email.to,
      subject: email.subject,
      text: email.text,
      attachmentIds: email.attachmentIds,
    }));
  };

  const handleSendEmail = async (application: Application) => {
    try {
      // Update status to sending
      setApplications(
        applications.map((p) =>
          p.id === application.id ? { ...p, status: "sending" as const } : p
        )
      );
      await updateApplicationStatus(application.id, "sending");

      // Prepare email item and add to queue
      const emailItems = await prepareEmailItems([application]);
      await emailQueue.addToQueue(emailItems);

      toast.success(`Email queued for ${application.name}`, {
        title: "Email Queued",
        persist: false,
      });
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      console.error("Error queueing email:", errorMessage);
      toast.error(`Failed to queue email: ${errorMessage}`);
      
      // Update status to error
      setApplications(
        applications.map((p) =>
          p.id === application.id
            ? { ...p, status: "error" as const, error: errorMessage }
            : p
        )
      );
      await updateApplicationStatus(application.id, "error", errorMessage);
    }
  };

  const handleBulkSend = async (applicationIds: string[]) => {
    const applicationsToSend = applications.filter((p) => applicationIds.includes(p.id));
    const total = applicationsToSend.length;

    try {
      // Update all to sending
      const applicationIds = applicationsToSend.map((app) => app.id);
      await ApplicationStatusService.updateMultipleStatuses(applicationIds, "sending");
      
      // Update local state
      setApplications((prev) =>
        prev.map((p) =>
          applicationIds.includes(p.id) ? { ...p, status: "sending" as const } : p
        )
      );

      // Prepare email items and add to queue
      const emailItems = await prepareEmailItems(applicationsToSend);
      await emailQueue.addToQueue(emailItems);

      toast.success(`Queued ${total} email(s) for sending`, {
        title: "Emails Queued",
        persist: false,
      });
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      console.error("Error queueing bulk emails:", errorMessage);
      toast.error(`Failed to queue emails: ${errorMessage}`);
      
      // Update status to error for all
      for (const application of applicationsToSend) {
        setApplications((prev) =>
          prev.map((p) =>
            p.id === application.id
              ? { ...p, status: "error" as const, error: errorMessage }
              : p
          )
        );
        await updateApplicationStatus(application.id, "error", errorMessage);
      }
    }
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
        const error: ApiErrorResponse = await response.json();
        throw new Error(error.error || "Failed to update application");
      }

      const updatedApplication: ApplicationApiResponse = await response.json();
      
      // Find the existing application to preserve its attachments
      const existingApp = applications.find((p) => p.id === id);
      
      // Fetch attachments if there are attachment IDs
      let attachmentObjects: ApplicationAttachment[] = [];
      if (updatedApplication.attachments && updatedApplication.attachments.length > 0) {
        try {
          const attachmentsResponse = await fetch("/api/attachments/batch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids: updatedApplication.attachments }),
          });
          if (attachmentsResponse.ok) {
            const attachments: AttachmentApiResponse[] = await attachmentsResponse.json();
            attachmentObjects = attachments.map((att) => ({
              id: att._id,
              filename: att.filename,
              content: att.content,
              contentType: att.contentType,
            }));
          }
        } catch (error) {
          console.warn("Failed to fetch attachments for updated application:", error);
          // Fall back to existing attachments if available
          attachmentObjects = existingApp?.attachments || [];
        }
      }
      
      // Update in local state
      const formattedApplication: Application = {
        id: updatedApplication._id,
        name: updatedApplication.name,
        university: updatedApplication.university,
        email: updatedApplication.email,
        emailText: updatedApplication.emailText,
        status: updatedApplication.status || "pending",
        error: updatedApplication.error,
        attachments: attachmentObjects,
        attachmentIds: updatedApplication.attachments || [],
      };
      
      setApplications(
        applications.map((p) => (p.id === id ? formattedApplication : p))
      );
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      toast.error(`Error updating application: ${errorMessage}`);
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
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      toast.error(`Error removing application: ${errorMessage}`);
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
                <NotificationBell />
                <Link href="/applications/new" className="w-full sm:w-auto">
                  <Button className="w-full sm:w-auto bg-primary hover:bg-primary/90">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Application
                  </Button>
                </Link>
                <Link href="/attachments" className="w-full sm:w-auto">
                  <Button variant="outline" className="w-full sm:w-auto">
                    <Paperclip className="h-4 w-4 mr-2" />
                    Attachments
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

        {/* Email Queue Progress */}
        {emailQueue.progress.total > 0 && (
          <EmailProgress
            progress={emailQueue.progress}
            onPause={emailQueue.pause}
            onResume={emailQueue.resume}
            onClear={emailQueue.clear}
            onClearCompleted={emailQueue.clearCompleted}
            isProcessing={emailQueue.isProcessing}
          />
        )}

        <ApplicationList
          applications={applications}
          onSendEmail={handleSendEmail}
          onBulkSend={handleBulkSend}
          onRemove={handleRemove}
          onAttachmentsUpdated={loadApplications}
          isQueueProcessing={emailQueue.isProcessing}
        />
      </div>
    </main>
  );
}
