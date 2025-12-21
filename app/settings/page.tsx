"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Save, Sparkles, Mail, User, FileText, Wand2, CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";
import { FormField } from "@/components/ui/form";
import { FileAttachments } from "@/app/components/FileAttachments";
import { Attachment } from "@/lib/utils/attachments";
import { useTemplate } from "@/lib/hooks/useTemplate";

interface TemplateFormData {
  content: string;
  description?: string;
  subject?: string;
}

interface ProfileFormData {
  yourName: string;
  yourEmail: string;
  yourDegree?: string;
  yourUniversity?: string;
  yourGPA?: string;
}

export default function SettingsPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [isTestingEmail, setIsTestingEmail] = useState(false);
  const [customizationPrompt, setCustomizationPrompt] = useState("");
  const [showCustomizationInput, setShowCustomizationInput] = useState(false);
  const [templateAttachments, setTemplateAttachments] = useState<Attachment[]>([]);
  
  // Use the reusable template hook
  const { templateData, isLoading: isLoadingTemplate, reloadTemplate } = useTemplate();

  const templateForm = useForm<TemplateFormData>({
    defaultValues: {
      content: "",
      description: "",
      subject: "",
    },
  });

  const profileForm = useForm<ProfileFormData>({
    defaultValues: {
      yourName: "",
      yourEmail: "",
      yourDegree: "",
      yourUniversity: "",
      yourGPA: "",
    },
  });

  const templateContent = templateForm.watch("content");

  useEffect(() => {
    const loadProfile = async () => {
      try {
        setIsLoading(true);
        
        // Template is loaded by useTemplate hook, update form when it's ready
        if (!isLoadingTemplate && templateData.content) {
          templateForm.reset({
            content: templateData.content,
            description: templateData.description || "",
            subject: templateData.subject || "",
          });
          // Sync attachments state with template data
          setTemplateAttachments(templateData.attachments);
        }

        // Load profile
        const profileResponse = await fetch("/api/profile");
        if (profileResponse.ok) {
          const profileData = await profileResponse.json();
          profileForm.reset({
            yourName: profileData.yourName || "",
            yourEmail: profileData.yourEmail || "",
            yourDegree: profileData.yourDegree || "",
            yourUniversity: profileData.yourUniversity || "",
            yourGPA: profileData.yourGPA || "",
          });
        }
      } catch (error: any) {
        toast.error(`Error loading settings: ${error.message}`);
      } finally {
        setIsLoading(false);
      }
    };

    loadProfile();
  }, [templateForm, profileForm, isLoadingTemplate, templateData]);

  const handleCustomize = async () => {
    if (!templateContent) {
      toast.error("Please enter a template first");
      return;
    }

    setIsCustomizing(true);
    try {
      const response = await fetch("/api/template/customize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          template: templateContent,
          customizationPrompt: customizationPrompt || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to customize template");
      }

      const data = await response.json();
      templateForm.setValue("content", data.customizedText);
      setCustomizationPrompt("");
      setShowCustomizationInput(false);
      toast.success("Template customized successfully!");
    } catch (error: any) {
      toast.error(`Error customizing template: ${error.message}`);
    } finally {
      setIsCustomizing(false);
    }
  };

  const handleTestEmail = async () => {
    setIsTestingEmail(true);
    try {
      const response = await fetch("/api/email", {
        method: "GET",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to send test email");
      }

      const data = await response.json();
      if (data.mocked) {
        toast.success("Test email would be sent (MOCK MODE). Configure SMTP settings to send real emails.");
      } else {
        toast.success(`Test email sent successfully to ${data.to}! Please check your inbox.`);
      }
    } catch (error: any) {
      toast.error(`Failed to send test email: ${error.message}`);
    } finally {
      setIsTestingEmail(false);
    }
  };

  const onTemplateSubmit = async (data: TemplateFormData) => {
    setIsSavingTemplate(true);
    try {
      const payload = {
        content: data.content,
        description: data.description,
        subject: data.subject,
        attachments: templateAttachments,
      };
      
      console.log("[Settings] Saving template with attachments:", {
        attachmentsCount: templateAttachments.length,
        attachments: templateAttachments,
      });

      const response = await fetch("/api/template", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error("[Settings] Failed to save template:", error);
        throw new Error(error.error || "Failed to save template");
      }

      const savedData = await response.json();
      console.log("[Settings] Template saved successfully:", {
        hasAttachments: !!savedData.attachments,
        attachmentsType: typeof savedData.attachments,
        attachmentsLength: savedData.attachments?.length || 0,
        attachments: savedData.attachments,
      });

      // Reload template data to ensure consistency
      await reloadTemplate();
      // Update local attachments state with saved data
      if (savedData.attachments) {
        setTemplateAttachments(savedData.attachments);
      }

      toast.success("Email template saved successfully!");
    } catch (error: any) {
      toast.error(`Error saving template: ${error.message}`);
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const onProfileSubmit = async (data: ProfileFormData) => {
    setIsSavingProfile(true);
    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save profile");
      }

      toast.success("Profile saved successfully!");
    } catch (error: any) {
      toast.error(`Error saving profile: ${error.message}`);
    } finally {
      setIsSavingProfile(false);
    }
  };

  if (isLoading) {
    return (
      <main className="min-h-screen bg-background p-4 md:p-8">
        <div className="max-w-4xl mx-auto flex flex-col items-center justify-center h-64 gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground font-medium">Loading settings...</p>
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
            <h1 className="text-2xl sm:text-3xl font-bold">Settings</h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Manage your email template and personal profile
            </p>
          </div>
        </div>

        {/* Personal Profile Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              <CardTitle>Personal Profile</CardTitle>
            </div>
            <CardDescription>
              Your personal information used to replace placeholders in email templates. Your data is kept private and not shared with AI.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="Your Name" error={profileForm.formState.errors.yourName?.message}>
                  <Input
                    placeholder="Enter your name"
                    {...profileForm.register("yourName", {
                      required: "Your name is required",
                    })}
                    className={profileForm.formState.errors.yourName ? "border-destructive" : ""}
                  />
                </FormField>
                <FormField label="Your Email" error={profileForm.formState.errors.yourEmail?.message}>
                  <Input
                    type="email"
                    placeholder="Enter your email address"
                    {...profileForm.register("yourEmail", {
                      required: "Your email is required",
                      pattern: {
                        value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                        message: "Please enter a valid email address",
                      },
                    })}
                    className={profileForm.formState.errors.yourEmail ? "border-destructive" : ""}
                  />
                </FormField>
              </div>
              <FormField label="Your Degree" error={profileForm.formState.errors.yourDegree?.message}>
                <Input
                  placeholder="Enter your degree (optional)"
                  {...profileForm.register("yourDegree")}
                  className={profileForm.formState.errors.yourDegree ? "border-destructive" : ""}
                />
              </FormField>
              <FormField label="Your University" error={profileForm.formState.errors.yourUniversity?.message}>
                <Input
                  placeholder="Enter your university (optional)"
                  {...profileForm.register("yourUniversity")}
                  className={profileForm.formState.errors.yourUniversity ? "border-destructive" : ""}
                />
              </FormField>
              <FormField label="Your GPA" error={profileForm.formState.errors.yourGPA?.message}>
                <Input
                  placeholder="Enter your GPA (optional)"
                  {...profileForm.register("yourGPA")}
                  className={profileForm.formState.errors.yourGPA ? "border-destructive" : ""}
                />
              </FormField>
              <div className="bg-muted p-4 rounded-md">
                <Label className="text-sm font-semibold mb-2 block">
                  How This Works:
                </Label>
                <ul className="text-sm space-y-1 text-muted-foreground">
                  <li>• Your information is stored securely in the database</li>
                  <li>• Placeholders like [YOUR_NAME], [YOUR_EMAIL] in templates are replaced with this data</li>
                  <li>• Your personal data is never sent to AI during template customization</li>
                  <li>• Only placeholders are shared with AI, keeping your privacy protected</li>
                </ul>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={isSavingProfile} className="w-full sm:w-auto bg-primary hover:bg-primary/90">
                  {isSavingProfile ? (
                    <>
                      <Save className="h-4 w-4 mr-2 animate-pulse" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Save Profile
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Email Template Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <CardTitle>Email Template</CardTitle>
            </div>
            <CardDescription>
              Use placeholders: [PROFESSOR_NAME], [PROFESSOR_EMAIL], [UNIVERSITY_NAME] (for recipient info)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 space-y-3">
              <div className="p-3 bg-muted border rounded-md">
                <p className="text-sm text-muted-foreground">
                  <strong className="text-foreground">SMTP Configuration:</strong> To test your email configuration, add <code className="bg-background px-1.5 py-0.5 rounded text-xs">SMTP_TEST_EMAIL</code> to your <code className="bg-background px-1.5 py-0.5 rounded text-xs">.env.local</code> file with your test email address, then click "Test Email Configuration".
                </p>
              </div>
              <div className="p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-md">
                <p className="text-sm text-amber-900 dark:text-amber-100 font-semibold mb-2">
                  ⚠️ For Tencent Exmail (@stu.yzu.edu.cn), you need an App Password:
                </p>
                <ol className="text-xs text-amber-800 dark:text-amber-200 space-y-1 list-decimal list-inside ml-2">
                  <li>Log in to Tencent Exmail web interface</li>
                  <li>Go to Settings (设置) → Account (账户)</li>
                  <li>Find "Email Binding" (邮箱绑定) or "Client Password" (客户端密码)</li>
                  <li>Click "Generate dedicated password" (生成专用密码)</li>
                  <li>Use this app password in <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">SMTP_PASS</code> (NOT your regular password)</li>
                </ol>
              </div>
            </div>
            <form onSubmit={templateForm.handleSubmit(onTemplateSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Input
                  id="description"
                  placeholder="e.g., Default email template"
                  {...templateForm.register("description")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="subject">Email Subject</Label>
                <Input
                  id="subject"
                  placeholder="Request for Admission Acceptance Letter for Master's Program"
                  {...templateForm.register("subject")}
                />
                <p className="text-xs text-muted-foreground">
                  The subject line for emails. You can use placeholders like [PROFESSOR_NAME].
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="content">Email Template</Label>
                <Textarea
                  id="content"
                  rows={20}
                  {...templateForm.register("content", {
                    required: "Email template content is required",
                    minLength: {
                      value: 10,
                      message: "Template must be at least 10 characters",
                    },
                  })}
                  className="font-mono text-sm"
                  placeholder="Enter your email template here..."
                />
                {templateForm.formState.errors.content && (
                  <p className="text-sm text-destructive">{templateForm.formState.errors.content.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Email Attachments (Optional)</Label>
                <p className="text-xs text-muted-foreground">
                  Files attached here will be included with all emails.
                </p>
                <FileAttachments
                  attachments={templateAttachments}
                  onAttachmentsChange={(newAttachments) => {
                    console.log("[Settings] Attachments changed:", {
                      oldCount: templateAttachments.length,
                      newCount: newAttachments.length,
                      newAttachments: newAttachments,
                    });
                    setTemplateAttachments(newAttachments);
                  }}
                />
              </div>
              <div className="bg-muted p-4 rounded-md">
                <Label className="text-sm font-semibold mb-2 block">
                  Available Placeholders:
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs font-semibold mb-1 text-foreground">Recipient Info:</p>
                    <ul className="text-sm space-y-1 text-muted-foreground">
                      <li>
                        <code className="bg-background px-2 py-1 rounded">[PROFESSOR_NAME]</code> - Recipient's name
                      </li>
                      <li>
                        <code className="bg-background px-2 py-1 rounded">[PROFESSOR_EMAIL]</code> - Recipient's email
                      </li>
                      <li>
                        <code className="bg-background px-2 py-1 rounded">[UNIVERSITY_NAME]</code> - University name
                      </li>
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-semibold mb-1 text-foreground">Your Info (from Profile):</p>
                    <ul className="text-sm space-y-1 text-muted-foreground">
                      <li>
                        <code className="bg-background px-2 py-1 rounded">[YOUR_NAME]</code> - Your name
                      </li>
                      <li>
                        <code className="bg-background px-2 py-1 rounded">[YOUR_EMAIL]</code> - Your email
                      </li>
                      <li>
                        <code className="bg-background px-2 py-1 rounded">[YOUR_DEGREE]</code> - Your degree
                      </li>
                      <li>
                        <code className="bg-background px-2 py-1 rounded">[YOUR_UNIVERSITY]</code> - Your university
                      </li>
                      <li>
                        <code className="bg-background px-2 py-1 rounded">[YOUR_GPA]</code> - Your GPA
                      </li>
                    </ul>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Note: Personal info placeholders are replaced from your profile settings, keeping your data private from AI.
                </p>
              </div>
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row gap-2 flex-wrap">
                  <Button
                    type="button"
                    onClick={() => setShowCustomizationInput(!showCustomizationInput)}
                    variant="outline"
                    disabled={isCustomizing || !templateContent}
                    className="w-full sm:w-auto border-purple-300 text-purple-700 hover:bg-purple-50 dark:border-purple-700 dark:text-purple-400 dark:hover:bg-purple-950/30"
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    {showCustomizationInput ? "Cancel AI Customization" : "Customize with AI"}
                  </Button>
                  {showCustomizationInput && (
                    <Button
                      type="button"
                      onClick={handleCustomize}
                      disabled={isCustomizing || !templateContent}
                      className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      {isCustomizing ? (
                        <>
                          <Wand2 className="h-4 w-4 mr-2 animate-spin" />
                          Customizing...
                        </>
                      ) : (
                        <>
                          <Wand2 className="h-4 w-4 mr-2" />
                          Apply AI Customization
                        </>
                      )}
                    </Button>
                  )}
                  <Button
                    type="button"
                    onClick={handleTestEmail}
                    disabled={isTestingEmail}
                    variant="outline"
                    className="w-full sm:w-auto border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-400 dark:hover:bg-blue-950/30"
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    {isTestingEmail ? (
                      <>
                        <Mail className="h-4 w-4 mr-2 animate-pulse" />
                        Sending Test Email...
                      </>
                    ) : (
                      "Test Email Configuration"
                    )}
                  </Button>
                  <Button type="submit" disabled={isSavingTemplate} className="w-full sm:w-auto bg-primary hover:bg-primary/90">
                    {isSavingTemplate ? (
                      <>
                        <Save className="h-4 w-4 mr-2 animate-pulse" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Save Template
                      </>
                    )}
                  </Button>
                </div>
                {showCustomizationInput && (
                  <div className="space-y-2 p-4 bg-muted rounded-md">
                    <Label htmlFor="customization-prompt">
                      Customization Instructions (Optional)
                    </Label>
                    <Textarea
                      id="customization-prompt"
                      rows={3}
                      placeholder="e.g., Make it more formal, Add more emphasis on research interests, Make it shorter and more concise..."
                      value={customizationPrompt}
                      onChange={(e) => setCustomizationPrompt(e.target.value)}
                      className="bg-background"
                    />
                    <p className="text-xs text-muted-foreground">
                      Leave empty for general improvements, or provide specific instructions for how you want the template customized.
                    </p>
                  </div>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
