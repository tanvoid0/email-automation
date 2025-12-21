"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
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
import { FileAttachments } from "./FileAttachments";
import { Attachment } from "@/lib/utils/attachments";
import { useTemplate } from "@/lib/hooks/useTemplate";
import { Sparkles, Plus, Wand2 } from "lucide-react";
import type { UserProfileData } from "@/lib/types/userProfile";

interface EmailFormProps {
  onAddApplication: (application: {
    name: string;
    university: string;
    email: string;
    baseTemplate: string;
    attachments?: Attachment[];
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
  const router = useRouter();
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [customizedEmail, setCustomizedEmail] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);

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

  // Update form when template loads
  useEffect(() => {
    if (!isLoadingTemplate && templateData.content) {
      setValue("emailText", templateData.content);
      setAttachments(templateData.attachments);
    }
  }, [isLoadingTemplate, templateData, setValue]);

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

      // Add new application
      onAddApplication({
        name: data.name.trim(),
        university: data.university.trim(),
        email: data.email.trim(),
        baseTemplate: finalEmailText.trim(),
        attachments: attachments.length > 0 ? attachments : undefined,
      });

      // Reset form
      reset();
      setCustomizedEmail(null);
      
      // Reload template data after reset - the useEffect will handle updating the form
      await reloadTemplate();
      
      toast.success("Application added successfully!");
      } catch (error) {
        const err = error as Error;
        toast.error(`Error adding professor: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
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
          <div className="space-y-2">
            <Label>Attachments (Optional)</Label>
            <p className="text-xs text-muted-foreground">
              Template attachments are automatically included. You can add additional files specific to this application.
            </p>
            <FileAttachments
              attachments={attachments}
              onAttachmentsChange={setAttachments}
            />
          </div>
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
  );
}
