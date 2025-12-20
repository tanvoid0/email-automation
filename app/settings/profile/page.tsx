"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";
import { FormField } from "@/components/ui/form";

interface ProfileFormData {
  yourName: string;
  yourEmail: string;
  yourDegree?: string;
  yourUniversity?: string;
  yourGPA?: string;
}

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
      yourName: "",
      yourEmail: "",
      yourDegree: "",
      yourUniversity: "",
      yourGPA: "",
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
            yourName: data.yourName || "",
            yourEmail: data.yourEmail || "",
            yourDegree: data.yourDegree || "",
            yourUniversity: data.yourUniversity || "",
            yourGPA: data.yourGPA || "",
          });
        } else {
          throw new Error("Failed to load profile");
        }
      } catch (error: any) {
        toast.error(`Error loading profile: ${error.message}`);
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
    } catch (error: any) {
      toast.error(`Error saving profile: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <main className="min-h-screen bg-background p-4 md:p-8">
        <div className="max-w-4xl mx-auto flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading profile...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/settings">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Personal Profile</h1>
            <p className="text-muted-foreground">
              Manage your personal information used in email templates
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Your Information</CardTitle>
            <CardDescription>
              This information will be used to replace placeholders in email templates.
              Your personal data is kept private and not shared with AI during customization.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="Your Name" error={errors.yourName?.message}>
                  <Input
                    placeholder="e.g., Nafisa Mubassira"
                    {...register("yourName", {
                      required: "Your name is required",
                    })}
                    className={errors.yourName ? "border-destructive" : ""}
                  />
                </FormField>
                <FormField label="Your Email" error={errors.yourEmail?.message}>
                  <Input
                    type="email"
                    placeholder="e.g., 228801027@stu.yzu.edu.cn"
                    {...register("yourEmail", {
                      required: "Your email is required",
                      pattern: {
                        value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                        message: "Please enter a valid email address",
                      },
                    })}
                    className={errors.yourEmail ? "border-destructive" : ""}
                  />
                </FormField>
              </div>
              <FormField label="Your Degree" error={errors.yourDegree?.message}>
                <Input
                  placeholder="e.g., B.Sc. in Microelectronics Science and Engineering"
                  {...register("yourDegree")}
                  className={errors.yourDegree ? "border-destructive" : ""}
                />
              </FormField>
              <FormField label="Your University" error={errors.yourUniversity?.message}>
                <Input
                  placeholder="e.g., Yangzhou University"
                  {...register("yourUniversity")}
                  className={errors.yourUniversity ? "border-destructive" : ""}
                />
              </FormField>
              <FormField label="Your GPA" error={errors.yourGPA?.message}>
                <Input
                  placeholder="e.g., 4.30/5.00"
                  {...register("yourGPA")}
                  className={errors.yourGPA ? "border-destructive" : ""}
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
                <Button type="submit" disabled={isSaving}>
                  <Save className="h-4 w-4 mr-2" />
                  {isSaving ? "Saving..." : "Save Profile"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

