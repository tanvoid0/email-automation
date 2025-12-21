"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmailForm } from "@/app/components/EmailForm";
import { ArrowLeft } from "lucide-react";

export default function NewApplicationPage() {
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
    }>;
  }) => {
    try {
      const response = await fetch("/api/applications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: applicationData.name,
          university: applicationData.university,
          email: applicationData.email,
          emailText: applicationData.baseTemplate,
          attachments: applicationData.attachments || [],
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to add application");
      }

      toast.success("Application added successfully!");
      // Redirect to home page after successful addition
      router.push("/");
    } catch (error: any) {
      toast.error(`Error adding application: ${error.message}`);
      throw error;
    }
  };

  return (
    <main className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-4 md:space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
          <Link href="/" className="w-full sm:w-auto">
            <Button variant="outline" size="sm" className="w-full sm:w-auto">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold">Add Application</h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Create a new application and customize the email template
            </p>
          </div>
        </div>

        <EmailForm
          onAddApplication={handleAddApplication}
          onCustomizeEmail={handleCustomizeEmail}
        />
      </div>
    </main>
  );
}

