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
import { ArrowLeft, Save, Sparkles, Mail } from "lucide-react";
import Link from "next/link";

interface TemplateFormData {
  content: string;
  description?: string;
  subject?: string;
}

export default function SettingsPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [isTestingEmail, setIsTestingEmail] = useState(false);
  const [customizationPrompt, setCustomizationPrompt] = useState("");
  const [showCustomizationInput, setShowCustomizationInput] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm<TemplateFormData>({
    defaultValues: {
      content: "",
      description: "",
      subject: "",
    },
  });

  const templateContent = watch("content");

  useEffect(() => {
    const loadTemplate = async () => {
      try {
        setIsLoading(true);
        const response = await fetch("/api/template");
        if (response.ok) {
          const data = await response.json();
          reset({
            content: data.content,
            description: data.description || "",
            subject: data.subject || "",
          });
        } else {
          throw new Error("Failed to load template");
        }
      } catch (error: any) {
        toast.error(`Error loading template: ${error.message}`);
      } finally {
        setIsLoading(false);
      }
    };

    loadTemplate();
  }, [reset]);

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
      setValue("content", data.customizedText);
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

  const onSubmit = async (data: TemplateFormData) => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/template", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: data.content,
          description: data.description,
          subject: data.subject,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save template");
      }

      toast.success("Email template saved successfully!");
    } catch (error: any) {
      toast.error(`Error saving template: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <main className="min-h-screen bg-background p-4 md:p-8">
        <div className="max-w-4xl mx-auto flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading template...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold">Email Template Settings</h1>
              <p className="text-muted-foreground">
                Customize the default email template used for new professors
              </p>
            </div>
          </div>
          <Link href="/settings/profile">
            <Button variant="outline">Personal Profile</Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Email Template</CardTitle>
            <CardDescription>
              Use placeholders: [PROFESSOR_NAME], [PROFESSOR_EMAIL], [UNIVERSITY_NAME]
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
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Input
                  id="description"
                  placeholder="e.g., Default template for professor outreach"
                  {...register("description")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="subject">Email Subject</Label>
                <Input
                  id="subject"
                  placeholder="Request for Admission Acceptance Letter for Master's Program"
                  {...register("subject")}
                />
                <p className="text-xs text-muted-foreground">
                  The subject line for emails sent to professors. You can use placeholders like [PROFESSOR_NAME].
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="content">Email Template</Label>
                <Textarea
                  id="content"
                  rows={20}
                  {...register("content", {
                    required: "Email template content is required",
                    minLength: {
                      value: 10,
                      message: "Template must be at least 10 characters",
                    },
                  })}
                  className="font-mono text-sm"
                  placeholder="Enter your email template here..."
                />
                {errors.content && (
                  <p className="text-sm text-destructive">{errors.content.message}</p>
                )}
              </div>
              <div className="bg-muted p-4 rounded-md">
                <Label className="text-sm font-semibold mb-2 block">
                  Available Placeholders:
                </Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs font-semibold mb-1 text-foreground">Professor Info:</p>
                    <ul className="text-sm space-y-1 text-muted-foreground">
                      <li>
                        <code className="bg-background px-2 py-1 rounded">[PROFESSOR_NAME]</code> - Professor's name
                      </li>
                      <li>
                        <code className="bg-background px-2 py-1 rounded">[PROFESSOR_EMAIL]</code> - Professor's email
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
                <div className="flex gap-2 flex-wrap">
                  <Button
                    type="button"
                    onClick={() => setShowCustomizationInput(!showCustomizationInput)}
                    variant="outline"
                    disabled={isCustomizing || !templateContent}
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    {showCustomizationInput ? "Cancel AI Customization" : "Customize with AI"}
                  </Button>
                  {showCustomizationInput && (
                    <Button
                      type="button"
                      onClick={handleCustomize}
                      disabled={isCustomizing || !templateContent}
                      variant="default"
                    >
                      {isCustomizing ? "Customizing..." : "Apply AI Customization"}
                    </Button>
                  )}
                  <Button
                    type="button"
                    onClick={handleTestEmail}
                    disabled={isTestingEmail}
                    variant="outline"
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    {isTestingEmail ? "Sending Test Email..." : "Test Email Configuration"}
                  </Button>
                  <Button type="submit" disabled={isSaving}>
                    <Save className="h-4 w-4 mr-2" />
                    {isSaving ? "Saving..." : "Save Template"}
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

