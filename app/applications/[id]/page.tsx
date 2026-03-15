"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Pencil, Mail, User, Building2, Send, CheckCircle2, XCircle, Clock, Paperclip, Loader2, RotateCw, RefreshCw, Trash2, Copy, Check, Ban } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AttachmentPreview } from "@/app/components/AttachmentPreview";
import { useToast } from "@/lib/hooks/useToast";
import { TIMEOUT_CONFIG } from "@/lib/config/timeouts";

interface Application {
  _id: string;
  name: string;
  university: string;
  email: string;
  emailText: string;
  status: "pending" | "sending" | "sent" | "error";
  error?: string;
  errorDetails?: {
    message: string;
    payloadSize?: {
      emailBodySizeKB: number;
      totalAttachmentSizeMB?: number;
      totalPayloadSizeMB?: number;
      attachmentsCount?: number;
      attachmentIdsCount?: number;
      requestPayloadSizeKB?: number;
      attachmentIds?: string[];
      attachmentDetails?: Array<{
        filename: string;
        sizeMB: number;
        contentType?: string;
      }>;
    };
    timestamp?: string;
    httpStatus?: number;
    httpStatusText?: string;
    recipient?: string;
    recipientEmail?: string;
    subject?: string;
    emailBodyPreview?: string;
    [key: string]: any;
  };
  attachments?: string[]; // Array of attachment IDs
}

export default function ViewApplicationPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const toast = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [application, setApplication] = useState<Application | null>(null);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [copied, setCopied] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Helper function for fetch with timeout
  const fetchWithTimeout = async (url: string, options: RequestInit, timeoutMs: number = TIMEOUT_CONFIG.HTTP_REQUEST) => {
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

  // Update application status
  const updateApplicationStatus = async (
    id: string,
    status: Application["status"],
    error?: string | null,
    errorDetails?: any | null
  ) => {
    try {
      const updateBody: any = { status };
      // Only include error/errorDetails if they're explicitly provided (including null to clear)
      if (error !== undefined) {
        updateBody.error = error;
      }
      if (errorDetails !== undefined) {
        updateBody.errorDetails = errorDetails;
      }

      const response = await fetch(`/api/applications/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updateBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update application status");
      }

      return await response.json();
    } catch (error: any) {
      console.error("Error updating application status:", error);
      throw error;
    }
  };

  useEffect(() => {
    const loadApplication = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/applications/${id}`);
        if (!response.ok) {
          throw new Error("Failed to load application");
        }
        const data = await response.json();
        
        // Log the raw data structure to verify attachments format
        console.log("[Application Details] Raw application data:", {
          hasAttachments: !!data.attachments,
          attachmentsType: typeof data.attachments,
          attachmentsIsArray: Array.isArray(data.attachments),
          attachmentsLength: data.attachments?.length || 0,
          attachmentsSample: data.attachments?.slice(0, 2),
        });
        
        // Ensure attachments is an array of IDs (strings), not objects
        // The API should return IDs, but we'll sanitize just in case
        if (data.attachments && Array.isArray(data.attachments)) {
          data.attachments = data.attachments.map((item: any) => {
            // If it's already a string ID, use it
            if (typeof item === 'string' && /^[0-9a-fA-F]{24}$/.test(item.trim())) {
              return item.trim();
            }
            // If it's an object with _id, extract it
            if (typeof item === 'object' && item !== null && item._id) {
              return String(item._id).trim();
            }
            // If it's an object with id, extract it
            if (typeof item === 'object' && item !== null && item.id) {
              return String(item.id).trim();
            }
            return null;
          }).filter((id: string | null): id is string => id !== null && /^[0-9a-fA-F]{24}$/.test(id));
        } else {
          data.attachments = [];
        }
        
        setApplication(data);
        
        // Load attachments if they exist (for display purposes only)
        if (data.attachments && data.attachments.length > 0) {
          try {
            const attachmentsResponse = await fetch("/api/attachments/batch", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ids: data.attachments }),
            });
            if (attachmentsResponse.ok) {
              const attachmentsData = await attachmentsResponse.json();
              setAttachments(attachmentsData);
            }
          } catch (error) {
            console.warn("Failed to load attachments:", error);
          }
        }
      } catch (error: any) {
        toast.error(`Error loading application: ${error.message}`);
        router.push("/");
      } finally {
        setIsLoading(false);
      }
    };

    if (id) {
      loadApplication();
    }
  }, [id, router]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "sent":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "error":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "sending":
        return <Clock className="h-4 w-4 text-blue-500 animate-spin" />;
      case "cancelled":
        return <Ban className="h-4 w-4 text-gray-500" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    const baseClasses = "capitalize font-medium";
    switch (status) {
      case "pending":
        return <Badge variant="outline" className={`${baseClasses} border-yellow-500 text-yellow-700 dark:text-yellow-400`}>Pending</Badge>;
      case "sending":
        return <Badge variant="outline" className={`${baseClasses} border-blue-500 text-blue-700 dark:text-blue-400`}>Sending</Badge>;
      case "sent":
        return <Badge variant="outline" className={`${baseClasses} border-green-500 text-green-700 dark:text-green-400`}>Sent</Badge>;
      case "error":
        return <Badge variant="outline" className={`${baseClasses} border-red-500 text-red-700 dark:text-red-400`}>Error</Badge>;
      case "cancelled":
        return <Badge variant="outline" className={`${baseClasses} border-gray-500 text-gray-700 dark:text-gray-400`}>Cancelled</Badge>;
      default:
        return <Badge variant="outline" className={baseClasses}>{status}</Badge>;
    }
  };

  const handleSendEmail = async () => {
    if (!application) return;

    // Prevent sending if already sent
    if (application.status === "sent") {
      toast.error(`Email already sent to ${application.name}`, {
        title: "Already Sent",
        description: "This email has already been sent. To send again, please create a new application.",
        persist: false,
      });
      return;
    }

    setIsSending(true);
    // Update status to sending
    setApplication({ ...application, status: "sending" });
    await updateApplicationStatus(application._id, "sending");

    const emailAttemptedAt = new Date();

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

      // Load template to get subject and attachment IDs
      let templateSubject = null;
      let templateAttachmentIds: string[] = [];
      try {
        const templateResponse = await fetch("/api/template");
        if (templateResponse.ok) {
          const templateData = await templateResponse.json();
          templateSubject = templateData.subject;
          // Template attachments are stored as IDs (strings)
          templateAttachmentIds = Array.isArray(templateData.attachments) 
            ? templateData.attachments.filter((id: any): id is string => 
                typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id.trim())
              )
            : [];
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

      // Collect all attachment IDs (template + application)
      // No need to fetch full attachment content - email API will do it server-side
      // IMPORTANT: application.attachments should be an array of IDs (strings), not full objects
      let applicationAttachmentIds: string[] = [];
      
      if (application.attachments && Array.isArray(application.attachments)) {
        // Filter to ensure we only have valid ObjectId strings
        applicationAttachmentIds = application.attachments
          .map((id: any) => {
            // If it's already a string, use it
            if (typeof id === 'string') {
              return id.trim();
            }
            // If it's an object with _id, extract the _id
            if (typeof id === 'object' && id !== null && id._id) {
              return String(id._id).trim();
            }
            // If it's an object with id, extract the id
            if (typeof id === 'object' && id !== null && id.id) {
              return String(id.id).trim();
            }
            return null;
          })
          .filter((id: string | null): id is string => 
            id !== null && /^[0-9a-fA-F]{24}$/.test(id)
          );
      }
      
      console.log("[Email Send - Details Page] Attachment IDs collected:", {
        templateAttachmentIds,
        applicationAttachmentIds,
        applicationAttachmentsRaw: application.attachments,
        applicationAttachmentsType: typeof application.attachments,
        applicationAttachmentsIsArray: Array.isArray(application.attachments),
      });
      
      // Merge template and application attachment IDs, removing duplicates
      const allAttachmentIds = Array.from(new Set([
        ...templateAttachmentIds,
        ...applicationAttachmentIds,
      ]));

      // Calculate request payload size (only email body + IDs, not attachment content)
      const emailBodySize = Buffer.byteLength(finalEmailText, 'utf8');
      const attachmentIdsSize = Buffer.byteLength(JSON.stringify(allAttachmentIds), 'utf8');
      const totalPayloadSize = emailBodySize + attachmentIdsSize;
      const totalPayloadSizeKB = (totalPayloadSize / 1024).toFixed(2);

      // Log payload information (request payload only, not final email size)
      console.log("[Email Send] Request payload analysis:", {
        recipient: application.name,
        email: application.email,
        emailBodySize: `${(emailBodySize / 1024).toFixed(2)} KB`,
        attachmentIdsCount: allAttachmentIds.length,
        attachmentIdsSize: `${(attachmentIdsSize / 1024).toFixed(2)} KB`,
        totalPayloadSize: `${totalPayloadSizeKB} KB`,
        templateAttachmentIdsCount: templateAttachmentIds.length,
        applicationAttachmentIdsCount: applicationAttachmentIds.length,
        timestamp: new Date().toISOString(),
      });

      // Prepare request body - ONLY send attachmentIds, NEVER full attachment content
      // CRITICAL: Do NOT include 'attachments' field with full content - only use 'attachmentIds'
      const requestBody: {
        to: string;
        subject: string;
        text: string;
        attachmentIds?: string[];
        // Explicitly DO NOT include 'attachments' field
      } = {
        to: application.email,
        subject,
        text: finalEmailText,
      };
      
      // Only add attachmentIds if we have any
      if (allAttachmentIds.length > 0) {
        requestBody.attachmentIds = allAttachmentIds;
      }
      
      // Verify we're not accidentally sending full attachment content
      const requestBodyString = JSON.stringify(requestBody);
      const requestBodySize = Buffer.byteLength(requestBodyString, 'utf8');
      const requestBodySizeKB = (requestBodySize / 1024).toFixed(2);
      
      // Check if request body contains any base64-like content (indicating full attachments)
      const hasBase64Content = requestBodyString.includes('data:') || 
                               requestBodyString.match(/[A-Za-z0-9+/]{100,}={0,2}/g)?.some((match) => match.length > 200);
      
      console.log("[Email Send - Details Page] Request body verification:", {
        hasAttachmentIds: !!requestBody.attachmentIds,
        attachmentIdsCount: requestBody.attachmentIds?.length || 0,
        attachmentIds: requestBody.attachmentIds,
        requestBodySizeKB,
        hasBase64Content: hasBase64Content,
        requestBodyPreview: requestBodyString.substring(0, 500),
        // Verify no 'attachments' field exists
        hasAttachmentsField: requestBodyString.includes('"attachments"'),
      });
      
      // Safety check: if request body is too large, something is wrong
      if (requestBodySize > 100 * 1024) { // 100 KB threshold
        const errorMsg = `Request body is unexpectedly large (${requestBodySizeKB} KB). This suggests full attachment content may be included.`;
        console.error("[Email Send - Details Page] ⚠️ ERROR:", {
          requestBodySizeKB,
          attachmentIdsCount: allAttachmentIds.length,
          possibleIssue: "Full attachment content may be included accidentally",
        });
        throw new Error(errorMsg);
      }
      
      // Safety check: if we detect base64 content, something is wrong
      if (hasBase64Content) {
        const errorMsg = "Detected base64 content in request body. Full attachment content should not be sent.";
        console.error("[Email Send - Details Page] ⚠️ ERROR:", errorMsg);
        throw new Error(errorMsg);
      }
      
      const response = await fetchWithTimeout(
        "/api/email",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: requestBodyString,
        },
        TIMEOUT_CONFIG.HTTP_REQUEST
      );

      if (!response.ok) {
        console.error("[Email Send] Request failed:", {
          status: response.status,
          statusText: response.statusText,
          recipient: application.name,
          email: application.email,
          requestPayloadSizeKB: totalPayloadSizeKB,
          attachmentIdsCount: allAttachmentIds.length,
          timestamp: new Date().toISOString(),
        });
        const errorMessage = await parseErrorResponse(response);
        console.error("[Email Send] Error details:", {
          errorMessage,
          recipient: application.name,
        });
        
        // Prepare detailed error information
        const errorDetails = {
          message: errorMessage || "Failed to send email",
          payloadSize: {
            emailBodySizeKB: parseFloat((emailBodySize / 1024).toFixed(2)),
            attachmentIdsCount: allAttachmentIds.length,
            requestPayloadSizeKB: parseFloat(totalPayloadSizeKB),
            attachmentIds: allAttachmentIds,
          },
          timestamp: new Date().toISOString(),
          httpStatus: response.status,
          httpStatusText: response.statusText,
          recipient: application.name,
          recipientEmail: application.email,
          subject: subject,
          emailBodyPreview: finalEmailText.substring(0, 200) + (finalEmailText.length > 200 ? '...' : ''),
        };
        
        // Store error with details
        await updateApplicationStatus(application._id, "error", errorMessage || "Failed to send email", errorDetails);
        setApplication({ ...application, status: "error", error: errorMessage || "Failed to send email", errorDetails });
        throw new Error(errorMessage || "Failed to send email");
      }

      // Update status to sent and clear any previous errors
      await updateApplicationStatus(application._id, "sent", null, null);
      
      // Reload application to get updated status
      const updatedResponse = await fetch(`/api/applications/${application._id}`);
      if (updatedResponse.ok) {
        const updatedData = await updatedResponse.json();
        setApplication(updatedData);
      } else {
        setApplication({ ...application, status: "sent", error: undefined, errorDetails: undefined });
      }
      
      const emailSucceededAt = new Date();
      toast.success(`Email sent to ${application.name}`, {
        title: "Email Sent Successfully",
        persist: true,
        metadata: {
          applicationId: application._id,
          emailAttemptedAt: emailAttemptedAt.toISOString(),
          emailSucceededAt: emailSucceededAt.toISOString(),
        },
      });
    } catch (error: any) {
      // Update status to error
      const errorSummary = error.message || "Failed to send email";
      setApplication({ 
        ...application, 
        status: "error", 
        error: errorSummary 
      });
      await updateApplicationStatus(application._id, "error", errorSummary);
      
      const emailFailedAt = new Date();
      toast.error(`Failed to send email to ${application.name}: ${error.message}`, {
        title: "Email Send Failed",
        persist: true,
        metadata: {
          applicationId: application._id,
          emailAttemptedAt: emailAttemptedAt.toISOString(),
          emailFailedAt: emailFailedAt.toISOString(),
          errorMessage: error.message,
        },
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleDelete = async () => {
    if (!application) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/applications/${application._id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete application");
      }

      toast.success("Application deleted successfully", {
        title: "Deleted",
        persist: true,
      });

      // Redirect to home page after successful deletion
      router.push("/");
    } catch (error: any) {
      console.error("Error deleting application:", error);
      toast.error(`Error deleting application: ${error.message}`, {
        title: "Delete Failed",
        persist: true,
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <main className="min-h-screen bg-background p-4 md:p-8">
        <div className="max-w-4xl mx-auto flex flex-col items-center justify-center h-64 gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground font-medium">Loading application...</p>
        </div>
      </main>
    );
  }

  if (!application) {
    return (
      <main className="min-h-screen bg-background p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground mb-4">Application not found</p>
              <Link href="/">
                <Button variant="outline">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Home
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-4 md:space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 flex-1 min-w-0">
            <Link href="/" className="w-full sm:w-auto">
              <Button variant="outline" size="sm" className="w-full sm:w-auto">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold">Application Details</h1>
              <p className="text-sm sm:text-base text-muted-foreground">
                Review application information and email template
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            {application.status === "pending" && (
              <Button
                onClick={handleSendEmail}
                disabled={isSending}
                className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white"
              >
                {isSending ? (
                  <>
                    <Clock className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send Email
                  </>
                )}
              </Button>
            )}
            {application.status === "error" && (
              <Button
                onClick={handleSendEmail}
                disabled={isSending}
                className="w-full sm:w-auto bg-orange-600 hover:bg-orange-700 text-white"
              >
                {isSending ? (
                  <>
                    <Clock className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <RotateCw className="h-4 w-4 mr-2" />
                    Retry
                  </>
                )}
              </Button>
            )}
            <Link href={`/applications/${id}/edit`} className="w-full sm:w-auto">
              <Button className="w-full sm:w-auto bg-primary hover:bg-primary/90">
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </Button>
            </Link>
            <Button
              onClick={() => {
                toast.error(`Delete ${application.name}?`, {
                  description: "This action cannot be undone.",
                  action: {
                    label: "Delete",
                    onClick: handleDelete,
                  },
                  cancel: {
                    label: "Cancel",
                    onClick: () => {},
                  },
                  duration: 5000,
                });
              }}
              disabled={isDeleting}
              variant="destructive"
              className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white"
            >
              {isDeleting ? (
                <>
                  <Clock className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Application Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Recipient Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Recipient Name</label>
                <p className="text-base font-medium mt-1">{application.name}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">University</label>
                <p className="text-base font-medium mt-1 flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  {application.university}
                </p>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Email Address</label>
              <p className="text-base font-medium mt-1 flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                {application.email}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Status</label>
              <div className="flex items-center gap-2 mt-1">
                {getStatusIcon(application.status)}
                {getStatusBadge(application.status)}
              </div>
              {application.error && (
                <div className="mt-2 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-md space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm text-red-700 dark:text-red-400 font-medium">Error Summary:</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/50"
                        onClick={async () => {
                          const errorText = application.errorDetails 
                            ? JSON.stringify({
                                summary: application.error || "Unknown error",
                                details: application.errorDetails
                              }, null, 2)
                            : application.error || "Unknown error";
                          
                          try {
                            await navigator.clipboard.writeText(errorText);
                            setCopied(true);
                            toast.success("Error details copied to clipboard");
                            setTimeout(() => setCopied(false), 2000);
                          } catch (err) {
                            toast.error("Failed to copy to clipboard");
                          }
                        }}
                        title="Copy error details"
                      >
                        {copied ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <p className="text-sm text-red-600 dark:text-red-300">{application.error}</p>
                  </div>
                  
                  {application.errorDetails && (
                    <div className="mt-3 pt-3 border-t border-red-300 dark:border-red-700 space-y-3">
                      <div>
                        <p className="text-xs font-semibold text-red-800 dark:text-red-300 mb-2">Detailed Error Information:</p>
                        <div className="bg-red-100 dark:bg-red-900/30 p-3 rounded text-xs font-mono space-y-1">
                          <div><span className="font-semibold">Message:</span> {application.errorDetails.message}</div>
                          {application.errorDetails.timestamp && (
                            <div><span className="font-semibold">Timestamp:</span> {new Date(application.errorDetails.timestamp).toLocaleString()}</div>
                          )}
                          {application.errorDetails.httpStatus && (
                            <div><span className="font-semibold">HTTP Status:</span> {application.errorDetails.httpStatus} {application.errorDetails.httpStatusText || ''}</div>
                          )}
                        </div>
                      </div>

                      {application.errorDetails.payloadSize && (
                        <div>
                          <p className="text-xs font-semibold text-red-800 dark:text-red-300 mb-2">Payload Size Information:</p>
                          <div className="bg-red-100 dark:bg-red-900/30 p-3 rounded text-xs space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                              <div><span className="font-semibold">Email Body:</span> {application.errorDetails.payloadSize.emailBodySizeKB} KB</div>
                              <div><span className="font-semibold">Total Attachments:</span> {application.errorDetails.payloadSize.attachmentsCount}</div>
                              <div><span className="font-semibold">Attachment Size:</span> {application.errorDetails.payloadSize.totalAttachmentSizeMB} MB</div>
                              <div><span className="font-semibold">Total Payload:</span> {application.errorDetails.payloadSize.totalPayloadSizeMB} MB</div>
                            </div>
                            
                            {application.errorDetails.payloadSize.attachmentDetails && application.errorDetails.payloadSize.attachmentDetails.length > 0 && (
                              <div className="mt-2 pt-2 border-t border-red-300 dark:border-red-700">
                                <p className="font-semibold mb-1">Individual Attachments:</p>
                                <ul className="space-y-1">
                                  {application.errorDetails.payloadSize.attachmentDetails.map((att, idx) => (
                                    <li key={idx} className="flex items-center justify-between">
                                      <span className="truncate flex-1">{att.filename}</span>
                                      <span className="ml-2 font-semibold">{att.sizeMB} MB</span>
                                      {att.contentType && (
                                        <span className="ml-2 text-red-600 dark:text-red-400">({att.contentType})</span>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {application.errorDetails.subject && (
                        <div>
                          <p className="text-xs font-semibold text-red-800 dark:text-red-300 mb-1">Email Subject:</p>
                          <div className="bg-red-100 dark:bg-red-900/30 p-2 rounded text-xs">{application.errorDetails.subject}</div>
                        </div>
                      )}

                      {application.errorDetails.emailBodyPreview && (
                        <div>
                          <p className="text-xs font-semibold text-red-800 dark:text-red-300 mb-1">Email Body Preview:</p>
                          <div className="bg-red-100 dark:bg-red-900/30 p-2 rounded text-xs font-mono whitespace-pre-wrap max-h-32 overflow-y-auto">
                            {application.errorDetails.emailBodyPreview}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Attachments */}
        {attachments.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Paperclip className="h-5 w-5 text-primary" />
                Attachments ({attachments.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {attachments.map((att, idx) => (
                  <li key={idx} className="flex items-center gap-2 text-sm">
                    <AttachmentPreview
                      id={att._id || att.id}
                      filename={att.filename}
                      content={att.content}
                      contentType={att.contentType}
                    >
                      <div className="flex items-center gap-2 hover:text-foreground transition-colors cursor-pointer">
                        <Paperclip className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">{att.filename}</span>
                        {att.contentType && (
                          <Badge variant="outline" className="text-xs">
                            {att.contentType}
                          </Badge>
                        )}
                      </div>
                    </AttachmentPreview>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Email Template */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              Email Template
            </CardTitle>
            <CardDescription>
              The email content that will be sent to the recipient
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-muted/50 rounded-md p-4 border">
              <pre className="whitespace-pre-wrap text-sm font-mono text-foreground">
                {application.emailText}
              </pre>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

