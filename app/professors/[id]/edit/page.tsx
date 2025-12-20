"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
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
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { replaceTemplatePlaceholders } from "@/lib/utils/template";
import { DEFAULT_EMAIL_TEMPLATE } from "@/lib/constants/emailTemplate";
import { EmailDiff } from "@/app/components/EmailDiff";

interface Professor {
  _id: string;
  name: string;
  university: string;
  email: string;
  emailText: string;
  status: string;
}

export default function EditProfessorPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [customizedEmail, setCustomizedEmail] = useState<string | null>(null);
  const [professor, setProfessor] = useState<Professor | null>(null);

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

  const emailText = watch("emailText");
  const professorName = watch("name");
  const universityName = watch("university");

  // Load professor data
  useEffect(() => {
    const loadProfessor = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/professors/${id}`);
        if (!response.ok) {
          throw new Error("Failed to load professor");
        }
        const data = await response.json();
        setProfessor(data);
        reset({
          name: data.name,
          university: data.university,
          email: data.email,
          emailText: data.emailText,
        });
      } catch (error: any) {
        toast.error(`Error loading professor: ${error.message}`);
        router.push("/");
      } finally {
        setIsLoading(false);
      }
    };

    if (id) {
      loadProfessor();
    }
  }, [id, reset, router]);

  const handleCustomize = async () => {
    if (!professorName || !universityName || !emailText) {
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
          professorName,
          universityName,
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

      const response = await fetch(`/api/professors/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: data.name,
          university: data.university,
          email: data.email,
          emailText: finalEmailText,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update professor");
      }

      toast.success("Professor updated successfully!");
      router.push("/");
    } catch (error: any) {
      toast.error(`Error updating professor: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <main className="min-h-screen bg-background p-4 md:p-8">
        <div className="max-w-4xl mx-auto flex items-center justify-center h-64">
          <div className="flex items-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p className="text-muted-foreground">Loading professor...</p>
          </div>
        </div>
      </main>
    );
  }

  if (!professor) {
    return (
      <main className="min-h-screen bg-background p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground mb-4">Professor not found</p>
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
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Edit Professor</h1>
            <p className="text-muted-foreground">
              Update professor details and email template
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Professor Information</CardTitle>
            <CardDescription>
              Update the professor details. AI customization is optional.
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
              <div className="flex gap-2">
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
                  {isSubmitting ? "Updating..." : "Update Professor"}
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

