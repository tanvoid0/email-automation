"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmailForm } from "./components/EmailForm";
import { ProfessorList, type Professor } from "./components/ProfessorList";
import { EmailPreview } from "./components/EmailPreview";

export const dynamic = "force-dynamic";

export default function Home() {
  const [professors, setProfessors] = useState<Professor[]>([]);
  const [selectedProfessor, setSelectedProfessor] = useState<Professor | null>(null);
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

  // Load professors from MongoDB on mount
  useEffect(() => {
    loadProfessors();
  }, []);

  const loadProfessors = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/professors");
      if (!response.ok) {
        throw new Error("Failed to load professors");
      }
      const data = await response.json();
      // Convert MongoDB documents to Professor format
      const formattedProfessors: Professor[] = data.map((p: any) => ({
        id: p._id,
        name: p.name,
        university: p.university,
        email: p.email,
        emailText: p.emailText,
        status: p.status || "pending",
        error: p.error,
      }));
      setProfessors(formattedProfessors);
    } catch (error: any) {
      console.error("Error loading professors:", error);
      toast.error(`Error loading professors: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddProfessor = async (professorData: {
    name: string;
    university: string;
    email: string;
    baseTemplate: string;
  }) => {
    try {
      const response = await fetch("/api/professors", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: professorData.name,
          university: professorData.university,
          email: professorData.email,
          emailText: professorData.baseTemplate,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to add professor");
      }

      const newProfessor = await response.json();
      
      // Add to local state
      const formattedProfessor: Professor = {
        id: newProfessor._id,
        name: newProfessor.name,
        university: newProfessor.university,
        email: newProfessor.email,
        emailText: newProfessor.emailText,
        status: newProfessor.status || "pending",
        error: newProfessor.error,
      };
      
      setProfessors([formattedProfessor, ...professors]);
      toast.success("Professor added successfully!");
    } catch (error: any) {
      toast.error(`Error adding professor: ${error.message}`);
      throw error;
    }
  };

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

  const updateProfessorStatus = async (
    id: string,
    status: Professor["status"],
    error?: string
  ) => {
    try {
      const response = await fetch(`/api/professors/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status, error }),
      });

      if (!response.ok) {
        throw new Error("Failed to update professor status");
      }

      return await response.json();
    } catch (error: any) {
      console.error("Error updating professor status:", error);
    }
  };

  const handleSendEmail = async (professor: Professor) => {
    // Update status to sending
    setProfessors(
      professors.map((p) =>
        p.id === professor.id ? { ...p, status: "sending" as const } : p
      )
    );
    await updateProfessorStatus(professor.id, "sending");

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

      // Load template to get subject
      let templateSubject = null;
      try {
        const templateResponse = await fetch("/api/template");
        if (templateResponse.ok) {
          const templateData = await templateResponse.json();
          templateSubject = templateData.subject;
        }
      } catch (error) {
        console.warn("Failed to load template for email sending");
      }

      // Replace any remaining placeholders in email text
      let finalEmailText = professor.emailText;
      if (userProfile) {
        const { replaceTemplatePlaceholders } = await import("@/lib/utils/template");
        finalEmailText = replaceTemplatePlaceholders(finalEmailText, {
          professorName: professor.name,
          professorEmail: professor.email,
          universityName: professor.university,
          yourName: userProfile.yourName,
          yourEmail: userProfile.yourEmail,
          yourDegree: userProfile.yourDegree,
          yourUniversity: userProfile.yourUniversity,
          yourGPA: userProfile.yourGPA,
        });
      }

      // Get subject from template or use fallback
      let subject = templateSubject || "Request for Admission Acceptance Letter for Master's Program";
      
      // Replace placeholders in subject if needed
      if (userProfile) {
        const { replaceTemplatePlaceholders } = await import("@/lib/utils/template");
        subject = replaceTemplatePlaceholders(subject, {
          professorName: professor.name,
          professorEmail: professor.email,
          universityName: professor.university,
          yourName: userProfile.yourName,
          yourEmail: userProfile.yourEmail,
          yourDegree: userProfile.yourDegree,
          yourUniversity: userProfile.yourUniversity,
          yourGPA: userProfile.yourGPA,
        });
      } else {
        // Replace basic placeholders even without profile
        const { replaceTemplatePlaceholders } = await import("@/lib/utils/template");
        subject = replaceTemplatePlaceholders(subject, {
          professorName: professor.name,
          professorEmail: professor.email,
          universityName: professor.university,
        });
      }

      const response = await fetchWithTimeout(
        "/api/email",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            to: professor.email,
            subject,
            text: finalEmailText,
          }),
        },
        30000 // 30 second timeout
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to send email");
      }

      // Update status to sent
      setProfessors(
        professors.map((p) =>
          p.id === professor.id ? { ...p, status: "sent" as const, error: undefined } : p
        )
      );
      await updateProfessorStatus(professor.id, "sent");
      toast.success(`Email sent to ${professor.name}`);
    } catch (error: any) {
      // Update status to error
      setProfessors(
        professors.map((p) =>
          p.id === professor.id
            ? { ...p, status: "error" as const, error: error.message }
            : p
        )
      );
      await updateProfessorStatus(professor.id, "error", error.message);
      toast.error(`Failed to send email to ${professor.name}: ${error.message}`);
    }
  };

  const handleBulkSend = async (professorIds: string[]) => {
    const professorsToSend = professors.filter((p) => professorIds.includes(p.id));
    const total = professorsToSend.length;

    // Initialize progress tracking
    setBulkSendProgress({ total, sent: 0, inProgress: true });

    // Update all to sending
    for (const professor of professorsToSend) {
      setProfessors((prev) =>
        prev.map((p) =>
          p.id === professor.id ? { ...p, status: "sending" as const } : p
        )
      );
      await updateProfessorStatus(professor.id, "sending");
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

    // Load template once for all emails to get subject
    let templateSubject = null;
    try {
      const templateResponse = await fetch("/api/template");
      if (templateResponse.ok) {
        const templateData = await templateResponse.json();
        templateSubject = templateData.subject;
      }
    } catch (error) {
      console.warn("Failed to load template for email sending");
    }

    let sentCount = 0;
    let successCount = 0;

    // Send emails sequentially to avoid overwhelming the SMTP server
    for (const professor of professorsToSend) {
      try {
        // Replace any remaining placeholders in email text
        let finalEmailText = professor.emailText;
        if (userProfile) {
          const { replaceTemplatePlaceholders } = await import("@/lib/utils/template");
          finalEmailText = replaceTemplatePlaceholders(finalEmailText, {
            professorName: professor.name,
            professorEmail: professor.email,
            universityName: professor.university,
            yourName: userProfile.yourName,
            yourEmail: userProfile.yourEmail,
            yourDegree: userProfile.yourDegree,
            yourUniversity: userProfile.yourUniversity,
            yourGPA: userProfile.yourGPA,
          });
        }

        // Get subject from template or use fallback
        let subject = templateSubject || "Request for Admission Acceptance Letter for Master's Program";
        
        // Replace placeholders in subject if needed
        if (userProfile) {
          const { replaceTemplatePlaceholders } = await import("@/lib/utils/template");
          subject = replaceTemplatePlaceholders(subject, {
            professorName: professor.name,
            professorEmail: professor.email,
            universityName: professor.university,
            yourName: userProfile.yourName,
            yourEmail: userProfile.yourEmail,
            yourDegree: userProfile.yourDegree,
            yourUniversity: userProfile.yourUniversity,
            yourGPA: userProfile.yourGPA,
          });
        } else {
          // Replace basic placeholders even without profile
          const { replaceTemplatePlaceholders } = await import("@/lib/utils/template");
          subject = replaceTemplatePlaceholders(subject, {
            professorName: professor.name,
            professorEmail: professor.email,
            universityName: professor.university,
          });
        }

        const response = await fetchWithTimeout(
          "/api/email",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              to: professor.email,
              subject,
              text: finalEmailText,
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
        setProfessors((prev) =>
          prev.map((p) =>
            p.id === professor.id
              ? { ...p, status: "sent" as const, error: undefined }
              : p
          )
        );
        await updateProfessorStatus(professor.id, "sent");
      } catch (error: any) {
        // Update status to error (but still count as processed)
        sentCount++;
        setBulkSendProgress({ total, sent: sentCount, inProgress: true });
        setProfessors((prev) =>
          prev.map((p) =>
            p.id === professor.id
              ? { ...p, status: "error" as const, error: error.message }
              : p
          )
        );
        await updateProfessorStatus(professor.id, "error", error.message);
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


  const handleUpdateProfessor = async (
    id: string,
    professorData: {
      name: string;
      university: string;
      email: string;
      baseTemplate: string;
    }
  ) => {
    try {
      const response = await fetch(`/api/professors/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: professorData.name,
          university: professorData.university,
          email: professorData.email,
          emailText: professorData.baseTemplate,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update professor");
      }

      const updatedProfessor = await response.json();
      
      // Update in local state
      const formattedProfessor: Professor = {
        id: updatedProfessor._id,
        name: updatedProfessor.name,
        university: updatedProfessor.university,
        email: updatedProfessor.email,
        emailText: updatedProfessor.emailText,
        status: updatedProfessor.status || "pending",
        error: updatedProfessor.error,
      };
      
      setProfessors(
        professors.map((p) => (p.id === id ? formattedProfessor : p))
      );
    } catch (error: any) {
      toast.error(`Error updating professor: ${error.message}`);
      throw error;
    }
  };

  const handleRemove = async (id: string) => {
    try {
      const response = await fetch(`/api/professors/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete professor");
      }

      setProfessors(professors.filter((p) => p.id !== id));
      if (selectedProfessor?.id === id) {
        setSelectedProfessor(null);
      }
      toast.success("Professor removed successfully");
    } catch (error: any) {
      toast.error(`Error removing professor: ${error.message}`);
    }
  };

  if (isLoading) {
    return (
      <main className="min-h-screen bg-background p-4 md:p-8">
        <div className="max-w-7xl mx-auto flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading professors...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h1 className="text-4xl font-bold mb-2">Email Automation</h1>
                <p className="text-muted-foreground">
                  Automate personalized emails to professors using AI
                </p>
              </div>
              <div className="flex gap-2">
                <Link href="/settings/profile">
                  <Button variant="outline">Profile</Button>
                </Link>
                <Link href="/settings">
                  <Button variant="outline">Template Settings</Button>
                </Link>
              </div>
            </div>

        <EmailForm
          onAddProfessor={handleAddProfessor}
          onCustomizeEmail={handleCustomizeEmail}
        />

        {selectedProfessor && (
          <EmailPreview
            original={selectedProfessor.emailText}
            customized={selectedProfessor.emailText}
            professorName={selectedProfessor.name}
            professorEmail={selectedProfessor.email}
          />
        )}

        <ProfessorList
          professors={professors}
          onSendEmail={handleSendEmail}
          onBulkSend={handleBulkSend}
          onRemove={handleRemove}
          bulkSendProgress={bulkSendProgress}
        />
      </div>
    </main>
  );
}
