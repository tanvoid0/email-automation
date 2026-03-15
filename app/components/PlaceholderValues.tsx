"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { UserProfileData } from "@/lib/types/userProfile";
import { AlertCircle, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PlaceholderValuesProps {
  professorName?: string;
  professorEmail?: string;
  universityName?: string;
}

export function PlaceholderValues({
  professorName = "",
  professorEmail = "",
  universityName = "",
}: PlaceholderValuesProps) {
  const [userProfile, setUserProfile] = useState<UserProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const response = await fetch("/api/profile");
        if (response.ok) {
          const data = await response.json();
          setUserProfile(data);
        }
      } catch (error) {
        console.warn("Failed to load user profile");
      } finally {
        setIsLoading(false);
      }
    };

    loadProfile();
  }, []);

  if (isLoading) {
    return null;
  }

  const placeholders = [
    {
      key: "[YOUR_NAME]",
      label: "Your Name",
      value: userProfile?.fullName || null,
      required: true,
    },
    {
      key: "[YOUR_EMAIL]",
      label: "Your Email",
      value: userProfile?.email || null,
      required: true,
    },
    {
      key: "[YOUR_DEGREE]",
      label: "Your Degree",
      value: userProfile?.degree || null,
      required: false,
    },
    {
      key: "[YOUR_UNIVERSITY]",
      label: "Your University",
      value: userProfile?.university || null,
      required: false,
    },
    {
      key: "[YOUR_GPA]",
      label: "Your GPA",
      value: userProfile?.gpa || null,
      required: false,
    },
    {
      key: "[PROFESSOR_NAME]",
      label: "Professor Name",
      value: professorName || null,
      required: true,
    },
    {
      key: "[PROFESSOR_EMAIL]",
      label: "Professor Email",
      value: professorEmail || null,
      required: true,
    },
    {
      key: "[UNIVERSITY_NAME]",
      label: "University Name",
      value: universityName || null,
      required: true,
    },
  ];

  // Check if any form-dependent fields have values (to avoid showing warnings when form is empty after reset)
  const formDependentKeys = ["[PROFESSOR_NAME]", "[PROFESSOR_EMAIL]", "[UNIVERSITY_NAME]"];
  const hasAnyFormValue = placeholders
    .filter((p) => formDependentKeys.includes(p.key))
    .some((p) => p.value);

  // Only count form-dependent placeholders as missing if at least one form field has been filled
  // This prevents showing confusing warnings right after form reset
  const missingRequired = placeholders.filter((p) => {
    if (!p.required || p.value) return false;
    // For form-dependent placeholders, only warn if user has started filling the form
    if (formDependentKeys.includes(p.key)) {
      return hasAnyFormValue;
    }
    // For profile-dependent placeholders, always warn if missing
    return true;
  }).length;

  const filledCount = placeholders.filter((p) => p.value).length;
  const totalCount = placeholders.length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <CardTitle className="text-base">Placeholder Values</CardTitle>
            <CardDescription className="text-xs mt-1">
              {isExpanded ? (
                <>These values will replace placeholders in your email template.</>
              ) : (
                <>
                  {filledCount}/{totalCount} values set
                  {missingRequired > 0 && (
                    <span className="text-destructive font-medium ml-1">
                      • {missingRequired} required {missingRequired === 1 ? "value" : "values"} missing
                    </span>
                  )}
                </>
              )}
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-8 w-8 p-0"
          >
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>
      {isExpanded && (
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {placeholders.map((placeholder) => {
              const hasValue = !!placeholder.value;
              const displayValue = placeholder.value || "Not set";
              
              return (
                <div
                  key={placeholder.key}
                  className="flex flex-col gap-1 p-2 rounded-md border bg-muted/30"
                >
                  <div className="flex items-center gap-1.5">
                    <code className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      {placeholder.key}
                    </code>
                    {placeholder.required && (
                      <Badge
                        variant={hasValue ? "default" : "destructive"}
                        className="text-xs h-4 px-1"
                      >
                        Required
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {hasValue ? (
                      <CheckCircle2 className="h-3 w-3 text-green-600 dark:text-green-400 flex-shrink-0" />
                    ) : (
                      <AlertCircle className="h-3 w-3 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                    )}
                    <span
                      className={cn(
                        "text-xs truncate",
                        hasValue
                          ? "text-foreground font-medium"
                          : "text-muted-foreground italic"
                      )}
                      title={displayValue}
                    >
                      {displayValue}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {placeholder.label}
                  </span>
                </div>
              );
            })}
          </div>
          {missingRequired > 0 && (
            <div className="mt-3 p-2.5 rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900">
              <p className="text-xs text-amber-900 dark:text-amber-200">
                <strong>Note:</strong> Some required values are missing. Please fill in the form fields above or update your profile in Settings to complete all placeholders.
              </p>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

