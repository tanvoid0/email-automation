"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
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
import { replaceTemplatePlaceholders } from "@/lib/utils/template";
import { DEFAULT_EMAIL_TEMPLATE } from "@/lib/constants/emailTemplate";
import { EmailDiff } from "./EmailDiff";
import { Attachment, fileToAttachment } from "@/lib/utils/attachments";
import { useTemplate } from "@/lib/hooks/useTemplate";
import { Sparkles, Plus, Wand2, Paperclip, File, Clock, Upload, X } from "lucide-react";
import type { UserProfileData } from "@/lib/types/userProfile";
import { PlaceholderValues } from "./PlaceholderValues";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface EmailFormProps {
  onAddApplication: (application: {
    name: string;
    university: string;
    email: string;
    baseTemplate: string;
    attachments?: (Attachment | string)[]; // Can be attachment objects or IDs
  }) => void;
  onCustomizeEmail: (
    baseTemplate: string,
    professorName: string,
    universityName: string
  ) => Promise<string>;
}

export function EmailForm({ 
  onAddApplication, 
  onCustomizeEmail,
}: EmailFormProps) {
  const toast = useToast();
  const router = useRouter();
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [customizedEmail, setCustomizedEmail] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedAttachmentIds, setSelectedAttachmentIds] = useState<Set<string>>(new Set());
  const [availableAttachments, setAvailableAttachments] = useState<Array<{_id: string; filename: string; contentType?: string}>>([]);
  const [isLoadingAttachments, setIsLoadingAttachments] = useState(false);
  const [isAttachmentsDialogOpen, setIsAttachmentsDialogOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Use the reusable template hook
  const { templateData, isLoading: isLoadingTemplate, reloadTemplate } = useTemplate();

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
      attachments: [],
    },
  });

  // Load available attachments
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
  // But only if we have template data loaded - otherwise wait for template to load first
  useEffect(() => {
    if (availableAttachments.length > 0 && selectedAttachmentIds.size > 0 && !isLoadingTemplate) {
      const availableIds = new Set(availableAttachments.map(att => att._id));
      const validSelectedIds = Array.from(selectedAttachmentIds).filter(id => availableIds.has(id));
      
      if (validSelectedIds.length !== selectedAttachmentIds.size) {
        // Some selected IDs are invalid (attachments were deleted)
        const invalidIds = Array.from(selectedAttachmentIds).filter(id => !availableIds.has(id));
        if (invalidIds.length > 0) {
          console.log(`[EmailForm] Found ${invalidIds.length} invalid attachment reference(s), cleaning up...`);
          // Clean up invalid references from the database
          const cleanupInvalidReferences = async () => {
            try {
              const response = await fetch("/api/attachments/cleanup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ cleanupReferences: true, cleanupDangling: false }),
              });
              
              if (response.ok) {
                const result = await response.json();
                if (result.references?.removedIds?.length > 0) {
                  console.log(`[EmailForm] Cleaned up ${result.references.removedIds.length} invalid attachment reference(s)`);
                  // Reload template to get updated state
                  await reloadTemplate();
                  await loadAvailableAttachments();
                }
              }
            } catch (error) {
              console.error("[EmailForm] Error cleaning up invalid references:", error);
            }
          };
          
          cleanupInvalidReferences().then(() => {
            // After cleanup, update the selected IDs to only valid ones
            setSelectedAttachmentIds(new Set(validSelectedIds));
          }).catch((error) => {
            console.error("[EmailForm] Error during cleanup:", error);
            // Still update UI even if cleanup fails
            setSelectedAttachmentIds(new Set(validSelectedIds));
          });
        } else {
          setSelectedAttachmentIds(new Set(validSelectedIds));
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableAttachments, isLoadingTemplate]);

  // Update form when template loads
  useEffect(() => {
    if (!isLoadingTemplate && templateData.content) {
      setValue("emailText", templateData.content);
    }
  }, [isLoadingTemplate, templateData.content, setValue]);

  // Sync selected attachments from template - this ensures template attachments are pre-selected by default
  // This should run whenever template data or available attachments change
  useEffect(() => {
    // Wait for both template and attachments to be loaded
    if (!isLoadingTemplate && availableAttachments.length > 0) {
      // Prioritize attachmentIds (new format)
      if (templateData.attachmentIds && templateData.attachmentIds.length > 0) {
        // Filter to only valid attachment IDs that actually exist
        const availableIds = new Set(availableAttachments.map(att => att._id));
        const validTemplateIds = templateData.attachmentIds.filter(id => availableIds.has(id));
        
        // Always set valid template IDs - this ensures they're pre-selected
        // Don't check if they're different, just set them to ensure they're selected
        if (validTemplateIds.length > 0) {
          console.log(`[EmailForm] Pre-selecting ${validTemplateIds.length} template attachment(s)`);
          setSelectedAttachmentIds(new Set(validTemplateIds));
        } else {
          // If no valid template IDs, clear selection
          if (selectedAttachmentIds.size > 0) {
            setSelectedAttachmentIds(new Set());
          }
        }
      } else if (templateData.attachments && templateData.attachments.length > 0) {
        // Legacy: try to match by filename if we have attachment objects
        const matchedIds = new Set<string>();
        templateData.attachments.forEach((templateAtt) => {
          const match = availableAttachments.find((att) => 
            att.filename === templateAtt.filename
          );
          if (match) {
            matchedIds.add(match._id);
          }
        });
        if (matchedIds.size > 0) {
          console.log(`[EmailForm] Pre-selecting ${matchedIds.size} template attachment(s) by filename match`);
          setSelectedAttachmentIds(matchedIds);
        }
      } else if (selectedAttachmentIds.size === 0 && templateData.attachmentIds && templateData.attachmentIds.length === 0) {
        // Template has no attachments, ensure selection is empty
        // (only clear if it's actually empty in template)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoadingTemplate, templateData.attachmentIds, templateData.attachments, availableAttachments]);

  const emailText = watch("emailText");
  const professorName = watch("name");
  const universityName = watch("university");

  const fillMockData = () => {
    const mockNames = [
      "Weifeng He",
      "Xiaoli Zhang",
      "Ming Chen",
      "Yan Wang",
      "Jian Liu",
      "Hui Li",
      "Qiang Zhao",
      "Feng Yang",
      "Lei Wu",
      "Yong Zhang",
    ];

    const mockUniversities = [
      "Shanghai Jiao Tong University",
      "Tsinghua University",
      "Peking University",
      "Fudan University",
      "Zhejiang University",
      "Nanjing University",
      "University of Science and Technology of China",
      "Harbin Institute of Technology",
      "Xi'an Jiaotong University",
      "Southeast University",
    ];

    const mockDomains = [
      "sjtu.edu.cn",
      "tsinghua.edu.cn",
      "pku.edu.cn",
      "fudan.edu.cn",
      "zju.edu.cn",
      "nju.edu.cn",
      "ustc.edu.cn",
      "hit.edu.cn",
      "xjtu.edu.cn",
      "seu.edu.cn",
    ];

    const randomName = mockNames[Math.floor(Math.random() * mockNames.length)];
    const randomUniversity = mockUniversities[Math.floor(Math.random() * mockUniversities.length)];
    const randomDomain = mockDomains[Math.floor(Math.random() * mockDomains.length)];
    const randomEmail = `${randomName.split(" ")[0].toLowerCase()}${Math.floor(Math.random() * 100)}@${randomDomain}`;

    setValue("name", randomName);
    setValue("university", randomUniversity);
    setValue("email", randomEmail);
  };

  const handleCustomize = async () => {
    if (!professorName || !universityName || !emailText) {
      return;
    }

    setIsCustomizing(true);
    try {
      const customized = await onCustomizeEmail(
        emailText,
        professorName,
        universityName
      );
      setCustomizedEmail(customized);
      // Don't update the form input automatically - let user accept changes
      toast.success("Email customized successfully! Review and apply changes if you want to use them.");
    } catch (error: any) {
      toast.error(`Error customizing email: ${error.message}`);
    } finally {
      setIsCustomizing(false);
    }
  };

  const handleApplyChanges = () => {
    if (customizedEmail) {
      setValue("emailText", customizedEmail);
      toast.success("Changes applied to email template!");
    }
  };

  const toggleAttachmentSelection = (attachmentId: string) => {
    const newSelected = new Set(selectedAttachmentIds);
    if (newSelected.has(attachmentId)) {
      newSelected.delete(attachmentId);
    } else {
      newSelected.add(attachmentId);
    }
    setSelectedAttachmentIds(newSelected);
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedFiles(files);
  };

  const handleRemoveSelectedFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
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

  const onSubmit = async (data: ApplicationFormData) => {
    setIsSubmitting(true);
    try {
      // Validate required fields before proceeding
      if (!data.name || !data.university || !data.email || !data.emailText) {
        toast.error("Please fill in all required fields");
        setIsSubmitting(false);
        return;
      }

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
          description: "Please set up your personal information (name and email) in settings before creating applications. This information is used to personalize your emails.",
          action: {
            label: "Go to Settings",
            onClick: () => router.push("/settings"),
          },
          duration: 10000, // Show for 10 seconds
        });
        setIsSubmitting(false);
        return;
      }

      // Use customized email if available, otherwise use base template with placeholders replaced
      let finalEmailText = customizedEmail || data.emailText;
      
      // Ensure we have email text
      if (!finalEmailText || finalEmailText.trim().length < 10) {
        toast.error("Email text is required and must be at least 10 characters");
        setIsSubmitting(false);
        return;
      }
      
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

      // Prepare attachments: send selected attachment IDs
      const attachmentIds = Array.from(selectedAttachmentIds);
      const allAttachments: (string | Attachment)[] = attachmentIds.length > 0 ? attachmentIds : [];

      // Add new application
      onAddApplication({
        name: data.name.trim(),
        university: data.university.trim(),
        email: data.email.trim(),
        baseTemplate: finalEmailText.trim(),
        attachments: allAttachments.length > 0 ? allAttachments : undefined,
      });

      // Reset form
      reset();
      setCustomizedEmail(null);
      // Reset selected attachments to template defaults
      if (templateData.attachmentIds && templateData.attachmentIds.length > 0) {
        setSelectedAttachmentIds(new Set(templateData.attachmentIds));
      } else {
        setSelectedAttachmentIds(new Set());
      }
      
      // Reload template data after reset - the useEffect will handle updating the form
      await reloadTemplate();
      
      // Toast is handled by the parent component (onAddApplication callback)
      } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error));
        toast.error(`Error adding professor: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
              <CardTitle>Add Application</CardTitle>
              <CardDescription>
                Enter application details. AI customization is optional - you can add directly or customize first.
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
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label>Email Attachments (Optional)</Label>
                <p className="text-xs text-muted-foreground">
                  Select attachments to include with this application. Template attachments are pre-selected.
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
                {selectedAttachmentIds.size > 0 && (
                  <span className="ml-2 px-1.5 py-0.5 bg-primary text-primary-foreground rounded text-xs">
                    {selectedAttachmentIds.size}
                  </span>
                )}
              </Button>
            </div>
          </div>
          <PlaceholderValues
            professorName={professorName}
            professorEmail={watch("email")}
            universityName={universityName}
          />
          <div className="flex flex-col sm:flex-row gap-2 flex-wrap">
            <Button
              type="button"
              onClick={fillMockData}
              variant="outline"
              className="text-xs w-full sm:w-auto border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300"
            >
              Fill Mock Data
            </Button>
            <Button
              type="button"
              onClick={handleCustomize}
              disabled={isCustomizing || !professorName || !universityName}
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
                  <Plus className="h-4 w-4 mr-2 animate-pulse" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Add to List
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
                onApply={handleApplyChanges}
              />
            </div>
          )}
        </form>
      </CardContent>
    </Card>

    {/* Attachments Management Dialog */}
    <Dialog open={isAttachmentsDialogOpen} onOpenChange={setIsAttachmentsDialogOpen}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Email Attachments</DialogTitle>
          <DialogDescription>
            Select attachments to include with this application. Template attachments are pre-selected.
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
            const availableSelectedCount = Array.from(selectedAttachmentIds).filter(id => 
              availableAttachments.some(att => att._id === id)
            ).length;
            const missingCount = selectedAttachmentIds.size - availableSelectedCount;
            
            return (
              <>
                {availableSelectedCount > 0 && (
                  <p className="text-xs text-muted-foreground text-center">
                    {availableSelectedCount} attachment{availableSelectedCount > 1 ? 's' : ''} selected
                  </p>
                )}
                {missingCount > 0 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 text-center">
                    {missingCount} selected attachment{missingCount > 1 ? 's' : ''} not found (may have been deleted)
                  </p>
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Attachment</DialogTitle>
          <DialogDescription>
            Upload files to attach to your emails. Files will be available for all applications.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="file-input">Select Files</Label>
            <Input
              id="file-input"
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              className="mt-2"
            />
          </div>
          
          {selectedFiles.length > 0 && (
            <div className="space-y-2">
              <Label>Selected Files</Label>
              <div className="space-y-2 max-h-[200px] overflow-y-auto border rounded-md p-3">
                {selectedFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-accent rounded-md">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <File className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-sm truncate">{file.name}</span>
                      <span className="text-xs text-muted-foreground">
                        ({(file.size / 1024).toFixed(1)} KB)
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveSelectedFile(index)}
                      className="h-6 w-6 p-0"
                    >
                      <X className="h-4 w-4" />
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
            disabled={selectedFiles.length === 0 || isUploading}
          >
            {isUploading ? (
              <>
                <Clock className="h-4 w-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Upload
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </div>
  );
}
