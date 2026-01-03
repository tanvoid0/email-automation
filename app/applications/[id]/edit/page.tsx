"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/lib/hooks/useToast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { applicationSchema, type ApplicationFormData } from "@/lib/validations/application";
import { FormField } from "@/components/ui/form";
import { ArrowLeft, Loader2, Sparkles, Save, Wand2 } from "lucide-react";
import type { UserProfileData } from "@/lib/types/userProfile";
import Link from "next/link";
import { replaceTemplatePlaceholders } from "@/lib/utils/template";
import { DEFAULT_EMAIL_TEMPLATE } from "@/lib/constants/emailTemplate";
import { EmailDiff } from "@/app/components/EmailDiff";
import { FileAttachments } from "@/app/components/FileAttachments";
import { Attachment } from "@/lib/utils/attachments";
import { PlaceholderValues } from "@/app/components/PlaceholderValues";

interface Application {
  _id: string;
  name: string;
  university: string;
  email: string;
  emailText: string;
  status: string;
}

export default function EditApplicationPage() {
  const toast = useToast();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [customizedEmail, setCustomizedEmail] = useState<string | null>(null);
  const [application, setApplication] = useState<Application | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [existingAttachmentIds, setExistingAttachmentIds] = useState<string[]>([]);
  const [userAddedAttachments, setUserAddedAttachments] = useState<Attachment[]>([]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    reset,
  } = useForm<ApplicationFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(applicationSchema) as any,
    defaultValues: {
      name: "",
      university: "",
      email: "",
      emailText: DEFAULT_EMAIL_TEMPLATE,
    },
  });

  const emailText = watch("emailText");
  const recipientName = watch("name");
  const universityName = watch("university");

  // Load application data
  useEffect(() => {
    const loadApplication = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/applications/${id}`);
        if (!response.ok) {
          throw new Error("Failed to load application");
        }
        const data = await response.json();
        setApplication(data);
        reset({
          name: data.name,
          university: data.university,
          email: data.email,
          emailText: data.emailText,
        });
        // Load attachments by ID if they exist
        if (data.attachments && data.attachments.length > 0) {
          // Store existing attachment IDs (these should be sent as IDs, not recreated)
          setExistingAttachmentIds(data.attachments.map((id: any) => id.toString()));
          try {
            const attachmentsResponse = await fetch("/api/attachments/batch", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ids: data.attachments }),
            });
            if (attachmentsResponse.ok) {
              const attachmentsData = await attachmentsResponse.json();
              setAttachments(attachmentsData.map((att: { filename: string; content: string; contentType?: string }) => ({
                filename: att.filename,
                content: att.content,
                contentType: att.contentType,
              })));
            }
          } catch (error) {
            console.warn("Failed to load attachments:", error);
            setAttachments([]);
          }
        } else {
          setExistingAttachmentIds([]);
          setAttachments([]);
        }
      } catch (error) {
        const err = error as Error;
        toast.error(`Error loading application: ${err.message}`);
        router.push("/");
      } finally {
        setIsLoading(false);
      }
    };

    if (id) {
      loadApplication();
    }
  }, [id, reset, router]);

  const handleCustomize = async () => {
    if (!recipientName || !universityName || !emailText) {
      return;
    }

    setIsCustomizing(true);
    try {
      const response = await fetch("/api/gemini", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          baseTemplate: emailText,
          professorName: recipientName,
          universityName: universityName,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to customize email");
      }

      const data = await response.json();
      setCustomizedEmail(data.customizedText);
      // Don't update the form input automatically - let user accept changes
      toast.success("Email customized successfully! Review and apply changes if you want to use them.");
    } catch (error: any) {
      toast.error(`Error customizing email: ${error.message}`);
    } finally {
      setIsCustomizing(false);
    }
  };

  const onSubmit = async (data: ApplicationFormData) => {
    setIsSubmitting(true);
    try {
      // Load user profile for personal info placeholders
      let userProfile: UserProfileData | null = null;
      try {
        const profileResponse = await fetch("/api/profile");
        if (profileResponse.ok) {
          userProfile = await profileResponse.json();
        }
      } catch (error) {
        console.warn("Failed to load user profile, using template as-is");
      }

      // Check if user profile is missing or incomplete
      if (!userProfile || !userProfile.fullName || !userProfile.email) {
        toast.error("User profile is required", {
          description: "Please set up your personal information (name and email) in settings before updating applications. This information is used to personalize your emails.",
          action: {
            label: "Go to Settings",
            onClick: () => router.push("/settings"),
          },
          duration: 10000,
        });
        setIsSubmitting(false);
        return;
      }

      // Use customized email if available, otherwise use base template with placeholders replaced
      let finalEmailText = customizedEmail || data.emailText;
      
      // If no customization was done, replace placeholders with actual values
      if (!customizedEmail) {
        finalEmailText = replaceTemplatePlaceholders(finalEmailText, {
          professorName: data.name,
          professorEmail: data.email,
          universityName: data.university,
          fullName: userProfile?.fullName,
          email: userProfile?.email,
          degree: userProfile?.degree,
          university: userProfile?.university,
          gpa: userProfile?.gpa,
        });
      }

      // Prepare attachments: send existing ones as IDs, new ones as objects
      // Existing attachments should be sent as IDs (they already exist), new files as objects
      const existingCount = existingAttachmentIds.length;
      const allAttachments: (string | Attachment)[] = [
        ...existingAttachmentIds, // Existing attachments as IDs (reuse - no new creation)
        ...attachments.slice(existingCount), // Only new files added by user (as objects)
      ];

      const response = await fetch(`/api/applications/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: data.name,
          university: data.university,
          email: data.email,
          emailText: finalEmailText,
          attachments: allAttachments.length > 0 ? allAttachments : undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update application");
      }

      toast.success("Application updated successfully!");
      router.push("/");
    } catch (error) {
      const err = error as Error;
      toast.error(`Error updating application: ${err.message}`);
    } finally {
      setIsSubmitting(false);
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
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
          <Link href="/" className="w-full sm:w-auto">
            <Button variant="outline" size="sm" className="w-full sm:w-auto">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold">Edit Application</h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Update application details and email template
            </p>
          </div>
        </div>

        <PlaceholderValues
          professorName={recipientName}
          professorEmail={watch("email")}
          universityName={universityName}
        />

        <Card>
          <CardHeader>
            <CardTitle>Application Information</CardTitle>
            <CardDescription>
              Update the application details. AI customization is optional.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="Recipient Name" error={errors.name?.message}>
                  <Input
                    placeholder="e.g., Weifeng He"
                    {...register("name")}
                    className={errors.name ? "border-destructive" : ""}
                  />
                </FormField>
                <FormField label="University Name" error={errors.university?.message}>
                  <Input
                    placeholder="e.g., Shanghai Jiao Tong University"
                    {...register("university")}
                    className={errors.university ? "border-destructive" : ""}
                  />
                </FormField>
              </div>
              <FormField label="Recipient Email" error={errors.email?.message}>
                <Input
                  type="email"
                  placeholder="e.g., hewf@sjtu.edu.cn"
                  {...register("email")}
                  className={errors.email ? "border-destructive" : ""}
                />
              </FormField>
              <FormField label="Email Template" error={errors.emailText?.message}>
                <Textarea
                  rows={15}
                  {...register("emailText")}
                  className={`font-mono text-sm ${errors.emailText ? "border-destructive" : ""}`}
                />
              </FormField>
              <div className="space-y-2">
                <Label>Attachments (Optional)</Label>
                <p className="text-xs text-muted-foreground">
                  Add files specific to this application. These will be merged with template attachments.
                </p>
            <FileAttachments
              attachments={attachments}
              onAttachmentsChange={(newAttachments) => {
                // Keep existing attachments at the beginning, new ones at the end
                const existingCount = existingAttachmentIds.length;
                const userAdded = newAttachments.slice(existingCount);
                setUserAddedAttachments(userAdded);
                setAttachments(newAttachments);
              }}
            />
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  type="button"
                  onClick={handleCustomize}
                  disabled={isCustomizing || !recipientName || !universityName}
                  variant="outline"
                  className="w-full sm:w-auto border-purple-300 text-purple-700 hover:bg-purple-50 dark:border-purple-700 dark:text-purple-400 dark:hover:bg-purple-950/30"
                >
                  {isCustomizing ? (
                    <>
                      <Wand2 className="h-4 w-4 mr-2 animate-spin" />
                      Customizing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Customize with AI (Optional)
                    </>
                  )}
                </Button>
                <Button 
                  type="submit"
                  variant="default"
                  disabled={isSubmitting}
                  className="w-full sm:w-auto bg-primary hover:bg-primary/90"
                >
                  {isSubmitting ? (
                    <>
                      <Save className="h-4 w-4 mr-2 animate-pulse" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Update Application
                    </>
                  )}
                </Button>
              </div>
              {customizedEmail && emailText && (
                <div className="mt-4">
                  <EmailDiff 
                    original={emailText} 
                    customized={customizedEmail} 
                    title="AI Customization Changes"
                    onApply={() => {
                      setValue("emailText", customizedEmail);
                      toast.success("Changes applied to email template!");
                    }}
                  />
                </div>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

