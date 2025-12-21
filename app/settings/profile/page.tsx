"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export const dynamic = "force-dynamic";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Save, CheckCircle2, User, Loader2 } from "lucide-react";
import Link from "next/link";
import { FormField } from "@/components/ui/form";

import type { UserProfileFormData } from "@/lib/types/userProfile";

type ProfileFormData = UserProfileFormData;

export default function ProfilePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ProfileFormData>({
    defaultValues: {
      fullName: "",
      email: "",
      degree: "",
      university: "",
      gpa: "",
    },
  });

  useEffect(() => {
    const loadProfile = async () => {
      try {
        setIsLoading(true);
        const response = await fetch("/api/profile");
        if (response.ok) {
          const data = await response.json();
          reset({
            fullName: data.fullName || "",
            email: data.email || "",
            degree: data.degree || "",
            university: data.university || "",
            gpa: data.gpa || "",
          });
        } else {
          throw new Error("Failed to load profile");
        }
      } catch (error) {
        const err = error as Error;
        toast.error(`Error loading profile: ${err.message}`);
      } finally {
        setIsLoading(false);
      }
    };

    loadProfile();
  }, [reset]);

  const onSubmit = async (data: ProfileFormData) => {
    setIsSaving(true);
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
    } catch (error) {
      const err = error as Error;
      toast.error(`Error saving profile: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <main className="min-h-screen bg-background p-4 md:p-8">
        <div className="max-w-4xl mx-auto flex flex-col items-center justify-center h-64 gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground font-medium">Loading profile...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-4 md:space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
          <Link href="/settings" className="w-full sm:w-auto">
            <Button variant="outline" size="sm" className="w-full sm:w-auto">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold">Personal Profile</h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Manage your personal information used in email templates
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              <CardTitle>Your Information</CardTitle>
            </div>
            <CardDescription>
              This information will be used to replace placeholders in email templates.
              Your personal data is kept private and not shared with AI during customization.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="Your Name" error={errors.fullName?.message}>
                  <Input
                    placeholder="e.g., Weifeng He"
                    {...register("fullName", {
                      required: "Your name is required",
                    })}
                    className={errors.fullName ? "border-destructive" : ""}
                  />
                </FormField>
                <FormField label="Your Email" error={errors.email?.message}>
                  <Input
                    type="email"
                    placeholder="e.g., hewf@sjtu.edu.cn"
                    {...register("email", {
                      required: "Your email is required",
                      pattern: {
                        value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                        message: "Please enter a valid email address",
                      },
                    })}
                    className={errors.email ? "border-destructive" : ""}
                  />
                </FormField>
              </div>
              <FormField label="Your Degree" error={errors.degree?.message}>
                <Input
                  placeholder="e.g., Master of Science in Computer Science"
                  {...register("degree")}
                  className={errors.degree ? "border-destructive" : ""}
                />
              </FormField>
              <FormField label="Your University" error={errors.university?.message}>
                <Input
                  placeholder="e.g., Shanghai Jiao Tong University"
                  {...register("university")}
                  className={errors.university ? "border-destructive" : ""}
                />
              </FormField>
              <FormField label="Your GPA" error={errors.gpa?.message}>
                <Input
                  placeholder="e.g., 3.80/4.00"
                  {...register("gpa")}
                  className={errors.gpa ? "border-destructive" : ""}
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
                <Button type="submit" disabled={isSaving} className="w-full sm:w-auto bg-primary hover:bg-primary/90">
                  {isSaving ? (
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
      </div>
    </main>
  );
}

