"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { useToast } from "@/lib/hooks/useToast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Save, Sparkles, Mail, User, FileText, Wand2, CheckCircle2, Loader2, File, Paperclip, Plus, Upload, Clock, X } from "lucide-react";
import Link from "next/link";
import { FormField } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Attachment, fileToAttachment } from "@/lib/utils/attachments";
import { useTemplate } from "@/lib/hooks/useTemplate";
import { useEmailQueue } from "@/lib/hooks/useEmailQueue";
import { cn } from "@/lib/utils";

interface TemplateFormData {
  content: string;
  description?: string;
  subject?: string;
}

import type { UserProfileFormData } from "@/lib/types/userProfile";

type ProfileFormData = UserProfileFormData;

export default function SettingsPage() {
  const toast = useToast();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [isTestingEmail, setIsTestingEmail] = useState(false);
  const [customizationPrompt, setCustomizationPrompt] = useState("");
  const [showCustomizationInput, setShowCustomizationInput] = useState(false);
  const [templateAttachments, setTemplateAttachments] = useState<Attachment[]>([]);
  const [selectedAttachmentIds, setSelectedAttachmentIds] = useState<Set<string>>(new Set());
  const [availableAttachments, setAvailableAttachments] = useState<Array<{_id: string; filename: string; contentType?: string}>>([]);
  const [isLoadingAttachments, setIsLoadingAttachments] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isPlaceholdersDialogOpen, setIsPlaceholdersDialogOpen] = useState(false);
  const [isSmtpInfoDialogOpen, setIsSmtpInfoDialogOpen] = useState(false);
  const [isAttachmentsDialogOpen, setIsAttachmentsDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Use the reusable template hook
  const { templateData, isLoading: isLoadingTemplate, reloadTemplate } = useTemplate();
  
  // Use email queue for batch size configuration
  const emailQueue = useEmailQueue();

  const templateForm = useForm<TemplateFormData>({
    defaultValues: {
      content: "",
      description: "",
      subject: "",
    },
  });

  const profileForm = useForm<ProfileFormData>({
    defaultValues: {
      fullName: "",
      email: "",
      degree: "",
      university: "",
      gpa: "",
    },
  });

  const templateContent = templateForm.watch("content");

  // Memoize loadAvailableAttachments to prevent infinite loops
  const loadAvailableAttachments = useCallback(async () => {
    try {
      setIsLoadingAttachments(true);
      const response = await fetch("/api/attachments");
      if (!response.ok) {
        throw new Error("Failed to load attachments");
      }
      const data = await response.json();
      setAvailableAttachments(data);
    } catch (error: any) {
      console.error("Error loading attachments:", error);
    } finally {
      setIsLoadingAttachments(false);
    }
  }, []);

  // Load available attachments once on mount
  useEffect(() => {
    loadAvailableAttachments();
  }, [loadAvailableAttachments]);

  // Clean up invalid attachment IDs when available attachments change
  useEffect(() => {
    if (availableAttachments.length > 0 && selectedAttachmentIds.size > 0) {
      const availableIds = new Set(availableAttachments.map(att => att._id));
      const validSelectedIds = Array.from(selectedAttachmentIds).filter(id => availableIds.has(id));
      
      if (validSelectedIds.length !== selectedAttachmentIds.size) {
        // Some selected IDs are invalid (attachments were deleted)
        // Automatically clean up invalid references from the template
        const invalidIds = Array.from(selectedAttachmentIds).filter(id => !availableIds.has(id));
        if (invalidIds.length > 0) {
          console.log(`[Settings] Found ${invalidIds.length} invalid attachment reference(s), cleaning up...`);
          // Clean up invalid references from the database first, then update UI
          cleanupInvalidReferences().then(() => {
            // After cleanup, update the selected IDs to only valid ones
            setSelectedAttachmentIds(new Set(validSelectedIds));
            toast.success(`Cleaned up ${invalidIds.length} invalid attachment reference(s)`);
          }).catch((error) => {
            console.error("[Settings] Error during cleanup:", error);
            // Still update UI even if cleanup fails
            setSelectedAttachmentIds(new Set(validSelectedIds));
          });
        } else {
          setSelectedAttachmentIds(new Set(validSelectedIds));
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableAttachments]);

  // Function to clean up invalid attachment references
  const cleanupInvalidReferences = useCallback(async () => {
    try {
      const response = await fetch("/api/attachments/cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cleanupReferences: true, cleanupDangling: false }),
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.references?.removedIds?.length > 0) {
          console.log(`[Settings] Cleaned up ${result.references.removedIds.length} invalid attachment reference(s)`);
          // Reload template to get updated state
          await reloadTemplate();
          await loadAvailableAttachments();
        }
      }
    } catch (error) {
      console.error("[Settings] Error cleaning up invalid references:", error);
    }
  }, [reloadTemplate, loadAvailableAttachments]);

  // Sync template data when it loads and check for invalid references
  useEffect(() => {
    if (!isLoadingTemplate && templateData.content) {
      templateForm.reset({
        content: templateData.content,
        description: templateData.description || "",
        subject: templateData.subject || "",
      });
      // Sync attachments state with template data
      setTemplateAttachments(templateData.attachments);
      // Set selected attachment IDs from template
      if (templateData.attachmentIds && templateData.attachmentIds.length > 0) {
        setSelectedAttachmentIds(new Set(templateData.attachmentIds));
        
        // Check if any of these IDs are invalid (attachment was deleted)
        // This will trigger cleanup if needed when availableAttachments loads
        if (availableAttachments.length > 0) {
          const availableIds = new Set(availableAttachments.map(att => att._id));
          const invalidIds = templateData.attachmentIds.filter((id: string) => !availableIds.has(id));
          if (invalidIds.length > 0) {
            console.log(`[Settings] Found ${invalidIds.length} invalid attachment reference(s) in template, will clean up...`);
            // The cleanup will be triggered by the useEffect that watches availableAttachments
          }
        }
      }
    }
  }, [isLoadingTemplate, templateData.content, templateData.description, templateData.subject, templateData.attachmentIds, templateForm, availableAttachments]);

  // Handle legacy attachment matching after available attachments load
  useEffect(() => {
    if (availableAttachments.length > 0 && templateAttachments.length > 0 && selectedAttachmentIds.size === 0) {
      const matchedIds = new Set<string>();
      templateAttachments.forEach((templateAtt) => {
        const match = availableAttachments.find((att) => 
          att.filename === templateAtt.filename
        );
        if (match) {
          matchedIds.add(match._id);
        }
      });
      if (matchedIds.size > 0) {
        setSelectedAttachmentIds(matchedIds);
      }
    }
  }, [availableAttachments, templateAttachments, selectedAttachmentIds.size]);

  // Load profile on mount
  useEffect(() => {
    const loadProfile = async () => {
      try {
        setIsLoading(true);
        const profileResponse = await fetch("/api/profile");
        if (profileResponse.ok) {
          const profileData = await profileResponse.json();
          profileForm.reset({
            fullName: profileData.fullName || "",
            email: profileData.email || "",
            degree: profileData.degree || "",
            university: profileData.university || "",
            gpa: profileData.gpa || "",
          });
        }
      } catch (error) {
        const err = error as Error;
        toast.error(`Error loading settings: ${err.message}`);
      } finally {
        setIsLoading(false);
      }
    };

    loadProfile();
  }, [profileForm]);

  const toggleAttachmentSelection = (attachmentId: string) => {
    const newSelected = new Set(selectedAttachmentIds);
    if (newSelected.has(attachmentId)) {
      newSelected.delete(attachmentId);
    } else {
      newSelected.add(attachmentId);
    }
    setSelectedAttachmentIds(newSelected);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    setSelectedFiles(Array.from(files));
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleOpenAddDialog = () => {
    setSelectedFiles([]);
    setIsAddDialogOpen(true);
  };

  const handleCloseAddDialog = () => {
    setIsAddDialogOpen(false);
    setSelectedFiles([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUploadAttachments = async () => {
    if (selectedFiles.length === 0) {
      toast.error("Please select at least one file");
      return;
    }

    setIsUploading(true);
    try {
      const uploadPromises = selectedFiles.map(async (file) => {
        const attachment = await fileToAttachment(file);
        
        const response = await fetch("/api/attachments", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(attachment),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || `Failed to upload ${file.name}`);
        }

        return await response.json();
      });

      const uploadedAttachments = await Promise.all(uploadPromises);
      
      // Add uploaded attachments to selected list
      const newSelected = new Set(selectedAttachmentIds);
      uploadedAttachments.forEach(att => {
        newSelected.add(att._id);
      });
      setSelectedAttachmentIds(newSelected);
      
      // Reload available attachments
      await loadAvailableAttachments();
      
      toast.success(`Successfully uploaded ${selectedFiles.length} attachment(s)`);
      handleCloseAddDialog();
    } catch (error: any) {
      toast.error(`Error uploading attachments: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

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
      // Filter out invalid attachment IDs before saving
      const availableIds = new Set(availableAttachments.map(att => att._id));
      const validAttachmentIds = Array.from(selectedAttachmentIds).filter(id => availableIds.has(id));
      
      // If there were invalid IDs, clean them up from the database
      if (validAttachmentIds.length !== selectedAttachmentIds.size) {
        await cleanupInvalidReferences();
      }
      
      // Convert selected attachment IDs to the format expected by the API
      // The API will handle creating/finding attachments if they're objects
      const attachmentIds = validAttachmentIds;
      
      const payload = {
        content: data.content,
        description: data.description,
        subject: data.subject,
        attachments: attachmentIds, // Send IDs, not full objects
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
      // Reload available attachments to get any new ones
      await loadAvailableAttachments();
      // Update selected attachment IDs from saved data
      if (savedData.attachments && Array.isArray(savedData.attachments)) {
        // Filter to only valid IDs
        const validIds = savedData.attachments.filter((id: any): id is string => 
          typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id.trim())
        );
        setSelectedAttachmentIds(new Set(validIds));
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

        {/* Email Queue Settings Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              <CardTitle>Email Queue Settings</CardTitle>
            </div>
            <CardDescription>
              Configure how many emails are sent in each batch to prevent timeouts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="batch-size">Batch Size</Label>
                <Input
                  id="batch-size"
                  type="number"
                  min="1"
                  max="50"
                  value={emailQueue.batchSize}
                  onChange={(e) => {
                    const value = parseInt(e.target.value, 10);
                    if (!isNaN(value) && value >= 1 && value <= 50) {
                      emailQueue.setBatchSize(value);
                      toast.success(`Batch size updated to ${value}`);
                    }
                  }}
                  className="max-w-[200px]"
                />
                <p className="text-xs text-muted-foreground">
                  Number of emails to send in each batch (1-50). Default: 10. Lower values reduce timeout risk.
                </p>
              </div>
              <div className="bg-muted p-4 rounded-md">
                <Label className="text-sm font-semibold mb-2 block">
                  How This Works:
                </Label>
                <ul className="text-sm space-y-1 text-muted-foreground">
                  <li>• Emails are processed in batches to prevent server timeouts</li>
                  <li>• Queue persists across browser sessions</li>
                  <li>• Progress is tracked in real-time</li>
                  <li>• Lower batch sizes are safer for slow SMTP servers</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

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
                <FormField label="Your Name" error={profileForm.formState.errors.fullName?.message}>
                  <Input
                    placeholder="Enter your name"
                    {...profileForm.register("fullName", {
                      required: "Your name is required",
                    })}
                    className={profileForm.formState.errors.fullName ? "border-destructive" : ""}
                  />
                </FormField>
                <FormField label="Your Email" error={profileForm.formState.errors.email?.message}>
                  <Input
                    type="email"
                    placeholder="Enter your email address"
                    {...profileForm.register("email", {
                      required: "Your email is required",
                      pattern: {
                        value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                        message: "Please enter a valid email address",
                      },
                    })}
                    className={profileForm.formState.errors.email ? "border-destructive" : ""}
                  />
                </FormField>
              </div>
              <FormField label="Your Degree" error={profileForm.formState.errors.degree?.message}>
                <Input
                  placeholder="Enter your degree (optional)"
                  {...profileForm.register("degree")}
                  className={profileForm.formState.errors.degree ? "border-destructive" : ""}
                />
              </FormField>
              <FormField label="Your University" error={profileForm.formState.errors.university?.message}>
                <Input
                  placeholder="Enter your university (optional)"
                  {...profileForm.register("university")}
                  className={profileForm.formState.errors.university ? "border-destructive" : ""}
                />
              </FormField>
              <FormField label="Your GPA" error={profileForm.formState.errors.gpa?.message}>
                <Input
                  placeholder="Enter your GPA (optional)"
                  {...profileForm.register("gpa")}
                  className={profileForm.formState.errors.gpa ? "border-destructive" : ""}
                />
              </FormField>
              <div className="bg-muted p-4 rounded-md">
                <Label className="text-sm font-semibold mb-2 block">
                  How This Works:
                </Label>
                <ul className="text-sm space-y-1 text-muted-foreground">
                  <li>• Your information is stored securely in the database</li>
                  <li>• Personal information placeholders in templates are replaced with your profile data</li>
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
              Use placeholders for recipient information (e.g., [PROFESSOR_NAME], [PROFESSOR_EMAIL], [UNIVERSITY_NAME])
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsSmtpInfoDialogOpen(true)}
                className="text-xs"
              >
                <Mail className="h-3 w-3 mr-1" />
                SMTP Configuration Info
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsPlaceholdersDialogOpen(true)}
                className="text-xs"
              >
                <FileText className="h-3 w-3 mr-1" />
                Available Placeholders
              </Button>
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
                  The subject line for emails. You can use placeholders for recipient information.
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
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Email Attachments (Optional)</Label>
                    <p className="text-xs text-muted-foreground">
                      Select attachments to include with all emails. These will be sent with every application email.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsAttachmentsDialogOpen(true)}
                  >
                    <Paperclip className="h-4 w-4 mr-2" />
                    Manage Attachments
                    {(() => {
                      // Only count attachments that are actually available
                      const availableSelectedCount = Array.from(selectedAttachmentIds).filter(id => 
                        availableAttachments.some(att => att._id === id)
                      ).length;
                      return availableSelectedCount > 0 ? (
                        <span className="ml-2 px-1.5 py-0.5 bg-primary text-primary-foreground rounded text-xs">
                          {availableSelectedCount}
                        </span>
                      ) : null;
                    })()}
                  </Button>
                </div>
              </div>

              {/* Attachments Management Dialog */}
              <Dialog open={isAttachmentsDialogOpen} onOpenChange={setIsAttachmentsDialogOpen}>
                <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Manage Email Attachments</DialogTitle>
                    <DialogDescription>
                      Select attachments to include with all emails. These will be sent with every application email.
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-4 py-4">
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleOpenAddDialog}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add New Attachment
                      </Button>
                    </div>
                    
                    {isLoadingAttachments ? (
                      <div className="flex items-center justify-center py-8">
                        <Clock className="h-4 w-4 animate-spin text-muted-foreground mr-2" />
                        <span className="text-sm text-muted-foreground">Loading attachments...</span>
                      </div>
                    ) : availableAttachments.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground border rounded-md">
                        <File className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No attachments available</p>
                        <p className="text-xs mt-1">Click "Add New Attachment" to upload attachments</p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[400px] overflow-y-auto border rounded-md p-3">
                        {availableAttachments.map((attachment) => (
                          <div
                            key={attachment._id}
                            className={cn(
                              "flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors",
                              selectedAttachmentIds.has(attachment._id)
                                ? "bg-primary/10 border border-primary"
                                : "hover:bg-accent border border-transparent"
                            )}
                            onClick={() => toggleAttachmentSelection(attachment._id)}
                          >
                            <Checkbox
                              checked={selectedAttachmentIds.has(attachment._id)}
                              onCheckedChange={() => toggleAttachmentSelection(attachment._id)}
                            />
                            <File className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{attachment.filename}</p>
                              {attachment.contentType && (
                                <p className="text-xs text-muted-foreground">{attachment.contentType}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                     {(() => {
                       // Only count attachments that are actually available
                       const availableSelectedCount = Array.from(selectedAttachmentIds).filter(id => 
                         availableAttachments.some(att => att._id === id)
                       ).length;
                       const missingCount = selectedAttachmentIds.size - availableSelectedCount;
                       
                       return (
                         <>
                           {availableSelectedCount > 0 && (
                             <p className="text-xs text-muted-foreground text-center">
                               {availableSelectedCount} attachment{availableSelectedCount > 1 ? 's' : ''} selected for template
                             </p>
                           )}
                           {missingCount > 0 && (
                             <div className="flex flex-col items-center gap-2">
                               <p className="text-xs text-amber-600 dark:text-amber-400 text-center">
                                 {missingCount} selected attachment{missingCount > 1 ? 's' : ''} not found (may have been deleted)
                               </p>
                               <Button
                                 type="button"
                                 variant="outline"
                                 size="sm"
                                 onClick={async () => {
                                   await cleanupInvalidReferences();
                                   toast.success("Cleaned up invalid attachment references");
                                 }}
                                 className="text-xs h-7"
                               >
                                 <X className="h-3 w-3 mr-1" />
                                 Clean Up References
                               </Button>
                             </div>
                           )}
                         </>
                       );
                     })()}
                  </div>

                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setIsAttachmentsDialogOpen(false)}
                    >
                      Done
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* Add Attachment Dialog */}
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Add New Attachment</DialogTitle>
                    <DialogDescription>
                      Upload one or more files to add to your attachments library
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-4 py-4">
                    <div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="w-full"
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        {isUploading ? "Uploading..." : "Choose Files"}
                      </Button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        onChange={handleFileSelect}
                        className="hidden"
                        accept="*/*"
                      />
                      <p className="text-xs text-muted-foreground mt-2">
                        Maximum file size: 10MB per file
                      </p>
                    </div>

                    {selectedFiles.length > 0 && (
                      <div className="space-y-2 border rounded-md p-3 bg-muted/50 max-h-[300px] overflow-y-auto">
                        <div className="text-sm font-medium">Selected Files ({selectedFiles.length}):</div>
                        <div className="space-y-1">
                          {selectedFiles.map((file, index) => (
                            <div
                              key={index}
                              className="flex items-center justify-between p-2 bg-background rounded border"
                            >
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <File className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm truncate" title={file.name}>
                                    {file.name}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {file.size ? `${(file.size / 1024).toFixed(1)} KB` : ''}
                                    {file.type && ` • ${file.type}`}
                                  </p>
                                </div>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveFile(index)}
                                disabled={isUploading}
                                className="flex-shrink-0"
                              >
                                <X className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={handleCloseAddDialog}
                      disabled={isUploading}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleUploadAttachments}
                      disabled={isUploading || selectedFiles.length === 0}
                    >
                      {isUploading ? (
                        <>
                          <Clock className="h-4 w-4 mr-2 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          Upload {selectedFiles.length > 0 ? `(${selectedFiles.length})` : ""}
                        </>
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* Placeholders Info Dialog */}
              <Dialog open={isPlaceholdersDialogOpen} onOpenChange={setIsPlaceholdersDialogOpen}>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Available Placeholders</DialogTitle>
                    <DialogDescription>
                      Use these placeholders in your email template. They will be automatically replaced with actual values.
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-4 py-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <p className="text-sm font-semibold">Recipient Info:</p>
                        <ul className="text-sm space-y-2 text-muted-foreground">
                          <li>
                            <code className="bg-muted px-2 py-1 rounded text-xs">[PROFESSOR_NAME]</code>
                            <span className="ml-2">- Recipient's name</span>
                          </li>
                          <li>
                            <code className="bg-muted px-2 py-1 rounded text-xs">[PROFESSOR_EMAIL]</code>
                            <span className="ml-2">- Recipient's email</span>
                          </li>
                          <li>
                            <code className="bg-muted px-2 py-1 rounded text-xs">[UNIVERSITY_NAME]</code>
                            <span className="ml-2">- University name</span>
                          </li>
                        </ul>
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm font-semibold">Your Info (from Profile):</p>
                        <ul className="text-sm space-y-2 text-muted-foreground">
                          <li>
                            <code className="bg-muted px-2 py-1 rounded text-xs">[YOUR_NAME]</code>
                            <span className="ml-2">- Your name</span>
                          </li>
                          <li>
                            <code className="bg-muted px-2 py-1 rounded text-xs">[YOUR_EMAIL]</code>
                            <span className="ml-2">- Your email</span>
                          </li>
                          <li>
                            <code className="bg-muted px-2 py-1 rounded text-xs">[YOUR_DEGREE]</code>
                            <span className="ml-2">- Your degree</span>
                          </li>
                          <li>
                            <code className="bg-muted px-2 py-1 rounded text-xs">[YOUR_UNIVERSITY]</code>
                            <span className="ml-2">- Your university</span>
                          </li>
                          <li>
                            <code className="bg-muted px-2 py-1 rounded text-xs">[YOUR_GPA]</code>
                            <span className="ml-2">- Your GPA</span>
                          </li>
                        </ul>
                      </div>
                    </div>
                    <div className="bg-muted p-3 rounded-md">
                      <p className="text-xs text-muted-foreground">
                        <strong className="text-foreground">Note:</strong> Personal info placeholders are replaced from your profile settings, keeping your data private from AI.
                      </p>
                    </div>
                  </div>

                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsPlaceholdersDialogOpen(false)}>
                      Close
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* SMTP Configuration Info Dialog */}
              <Dialog open={isSmtpInfoDialogOpen} onOpenChange={setIsSmtpInfoDialogOpen}>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>SMTP Configuration</DialogTitle>
                    <DialogDescription>
                      Information about configuring SMTP settings for sending emails
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-4 py-4">
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

                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsSmtpInfoDialogOpen(false)}>
                      Close
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
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
