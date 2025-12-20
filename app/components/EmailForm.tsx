"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { professorSchema, type ProfessorFormData } from "@/lib/validations/professor";
import { FormField } from "@/components/ui/form";
import { replaceTemplatePlaceholders } from "@/lib/utils/template";
import { DEFAULT_EMAIL_TEMPLATE } from "@/lib/constants/emailTemplate";
import { EmailDiff } from "./EmailDiff";

interface EmailFormProps {
  onAddProfessor: (professor: {
    name: string;
    university: string;
    email: string;
    baseTemplate: string;
  }) => void;
  onCustomizeEmail: (
    baseTemplate: string,
    professorName: string,
    universityName: string
  ) => Promise<string>;
}

export function EmailForm({ 
  onAddProfessor, 
  onCustomizeEmail,
}: EmailFormProps) {
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [customizedEmail, setCustomizedEmail] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(true);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    reset,
  } = useForm<ProfessorFormData>({
    resolver: zodResolver(professorSchema),
    defaultValues: {
      name: "",
      university: "",
      email: "",
      emailText: DEFAULT_EMAIL_TEMPLATE,
    },
  });

  // Load template from API on mount (DB is single source of truth, constant is fallback)
  useEffect(() => {
    const loadTemplate = async () => {
      try {
        setIsLoadingTemplate(true);
        const response = await fetch("/api/template");
        if (response.ok) {
          const data = await response.json();
          setValue("emailText", data.content);
        } else {
          // Fallback to constant only if API fails
          console.warn("Failed to load template from DB, using fallback");
          setValue("emailText", DEFAULT_EMAIL_TEMPLATE);
        }
      } catch (error: any) {
        console.error("Error loading template:", error);
        // Fallback to constant only if API fails
        setValue("emailText", DEFAULT_EMAIL_TEMPLATE);
      } finally {
        setIsLoadingTemplate(false);
      }
    };

    loadTemplate();
  }, [setValue]);

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

  const onSubmit = async (data: ProfessorFormData) => {
    setIsSubmitting(true);
    try {
      // Load user profile for personal info placeholders
      let userProfile = null;
      try {
        const profileResponse = await fetch("/api/profile");
        if (profileResponse.ok) {
          userProfile = await profileResponse.json();
        }
      } catch (error) {
        console.warn("Failed to load user profile, using template as-is");
      }

      // Use customized email if available, otherwise use base template with placeholders replaced
      let finalEmailText = customizedEmail || data.emailText;
      
      // If no customization was done, replace placeholders with actual values
      if (!customizedEmail) {
        finalEmailText = replaceTemplatePlaceholders(finalEmailText, {
          professorName: data.name,
          professorEmail: data.email,
          universityName: data.university,
          yourName: userProfile?.yourName,
          yourEmail: userProfile?.yourEmail,
          yourDegree: userProfile?.yourDegree,
          yourUniversity: userProfile?.yourUniversity,
          yourGPA: userProfile?.yourGPA,
        });
      }

      // Add new professor
      onAddProfessor({
        name: data.name,
        university: data.university,
        email: data.email,
        baseTemplate: finalEmailText,
      });

      // Reset form
      reset();
      setCustomizedEmail(null);
      toast.success("Professor added successfully!");
    } catch (error: any) {
      toast.error(`Error adding professor: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add Professor</CardTitle>
        <CardDescription>
          Enter professor details. AI customization is optional - you can add directly or customize first.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Professor Name" error={errors.name?.message}>
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
          <FormField label="Professor Email" error={errors.email?.message}>
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
          <div className="flex gap-2 flex-wrap">
            <Button
              type="button"
              onClick={fillMockData}
              variant="outline"
              className="text-xs"
            >
              Fill Mock Data
            </Button>
            <Button
              type="button"
              onClick={handleCustomize}
              disabled={isCustomizing || !professorName || !universityName}
              variant="outline"
            >
              {isCustomizing ? "Customizing..." : "Customize with AI (Optional)"}
            </Button>
            <Button 
              type="submit"
              variant="default"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Adding..." : "Add to List"}
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
