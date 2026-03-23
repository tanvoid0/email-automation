"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useToast } from "@/lib/hooks/useToast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import type { SOPSectionEntry } from "@/lib/types/sop";
import type { TemplateSection } from "@/lib/types/sopTemplate";

interface ApplicationOption {
  _id: string;
  name: string;
  university: string;
}

interface TemplateOption {
  _id: string;
  name: string;
  description?: string;
  sections: TemplateSection[];
}

const MONGO_ID_RE = /^[0-9a-fA-F]{24}$/;

export default function NewSOPPage() {
  const toast = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const admissionApplicationId = useMemo(() => {
    const raw = searchParams.get("admissionApplicationId")?.trim() ?? "";
    return MONGO_ID_RE.test(raw) ? raw : null;
  }, [searchParams]);
  const [applications, setApplications] = useState<ApplicationOption[]>([]);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [loadingApps, setLoadingApps] = useState(true);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [title, setTitle] = useState("");
  const [applicationId, setApplicationId] = useState<string | undefined>(undefined);
  const [templateId, setTemplateId] = useState<string | undefined>(undefined);
  const [content, setContent] = useState("");
  const [sectionContents, setSectionContents] = useState<Record<string, string>>({});
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateOption | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [contentError, setContentError] = useState<string | null>(null);

  useEffect(() => {
    const loadApplications = async () => {
      try {
        const response = await fetch("/api/applications");
        if (!response.ok) throw new Error("Failed to load applications");
        const data = await response.json();
        setApplications(data);
      } catch {
        toast.error("Failed to load applications list");
      } finally {
        setLoadingApps(false);
      }
    };
    loadApplications();
  }, [toast]);

  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const response = await fetch("/api/sop-templates");
        if (!response.ok) throw new Error("Failed to load templates");
        const data = await response.json();
        setTemplates(data);
      } catch {
        toast.error("Failed to load templates");
      } finally {
        setLoadingTemplates(false);
      }
    };
    loadTemplates();
  }, [toast]);

  useEffect(() => {
    if (!templateId || templateId === "none") {
      setSelectedTemplate(null);
      setSectionContents({});
      return;
    }
    const t = templates.find((x) => x._id === templateId);
    if (t) {
      setSelectedTemplate(t);
      setSectionContents((prev) => {
        const next: Record<string, string> = {};
        const sorted = [...(t.sections || [])].sort((a, b) => a.order - b.order);
        sorted.forEach((s) => {
          next[s.key] = prev[s.key] ?? "";
        });
        return next;
      });
    } else {
      setSelectedTemplate(null);
      setSectionContents({});
    }
  }, [templateId, templates]);

  const validate = (): boolean => {
    let ok = true;
    if (!title || title.trim().length < 2) {
      setTitleError("Title is required (at least 2 characters)");
      ok = false;
    } else setTitleError(null);
    if (selectedTemplate && selectedTemplate.sections?.length) {
      const hasAny = selectedTemplate.sections.some(
        (s) => (sectionContents[s.key] ?? "").trim().length >= 10
      );
      if (!hasAny) {
        setContentError("Fill in at least one section (min 10 characters)");
        ok = false;
      } else setContentError(null);
    } else {
      if ((content ?? "").trim().length < 10) {
        setContentError("Content is required (at least 10 characters)");
        ok = false;
      } else setContentError(null);
    }
    return ok;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsSubmitting(true);
    try {
      const body: {
        title: string;
        content?: string;
        applicationId?: string;
        admissionApplicationId?: string;
        templateId?: string;
        sections?: SOPSectionEntry[];
      } = {
        title: title.trim(),
      };
      if (applicationId) body.applicationId = applicationId;
      if (admissionApplicationId) body.admissionApplicationId = admissionApplicationId;
      if (selectedTemplate && selectedTemplate.sections?.length) {
        body.templateId = templateId ?? undefined;
        const sorted = [...selectedTemplate.sections].sort((a, b) => a.order - b.order);
        body.sections = sorted.map((s) => ({
          key: s.key,
          content: (sectionContents[s.key] ?? "").trim(),
        }));
      } else {
        body.content = content.trim();
      }

      const response = await fetch("/api/sop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to create SOP");
      }
      const created = await response.json();
      toast.success("SOP created successfully");
      if (admissionApplicationId) {
        router.push(`/admissions/${admissionApplicationId}`);
      } else {
        router.push(`/sop/${created._id}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create SOP";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const sortedSections = selectedTemplate
    ? [...(selectedTemplate.sections || [])].sort((a, b) => a.order - b.order)
    : [];

  const backHref = admissionApplicationId ? `/admissions/${admissionApplicationId}` : "/sop";
  const cancelHref = admissionApplicationId ? `/admissions/${admissionApplicationId}` : "/sop";

  return (
    <main className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Link href={backHref}>
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">New Statement of Purpose</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Create an SOP. Use a template for sectioned structure or write freeform.
            </p>
            {admissionApplicationId && (
              <p className="text-sm text-muted-foreground mt-2 rounded-md border bg-muted/40 px-3 py-2">
                This SOP will be attached to the admission application when you create it (replacing any previously
                linked SOP for that application).
              </p>
            )}
          </div>
        </div>

        <form onSubmit={onSubmit}>
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>SOP Details</CardTitle>
              <CardDescription>
                Title and optional link to an email workspace application. Choose a template to write by sections.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField label="Title" error={titleError ?? undefined}>
                <Input
                  placeholder="e.g. Stanford University – CS PhD"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className={titleError ? "border-destructive" : ""}
                />
              </FormField>

              <FormField label="Base template (optional)">
                <Select
                  value={templateId ?? "none"}
                  onValueChange={(v) => setTemplateId(v === "none" ? undefined : v)}
                  disabled={loadingTemplates}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="— None (freeform) —" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— None (freeform) —</SelectItem>
                    {templates.map((t) => (
                      <SelectItem key={t._id} value={t._id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Using a template shows one field per section (e.g. About you, Why this university).
                </p>
              </FormField>

              <FormField label="Link to email workspace application (optional)">
                <Select
                  value={applicationId ?? "none"}
                  onValueChange={(v) => setApplicationId(v === "none" ? undefined : v)}
                  disabled={loadingApps}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="— None (standalone) —" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— None (standalone) —</SelectItem>
                    {applications.map((app) => (
                      <SelectItem key={app._id} value={app._id}>
                        {app.name} – {app.university}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {admissionApplicationId && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Admission linkage comes from the application you opened this page from. This field is only for
                    linking to an entry in the email applications workspace.
                  </p>
                )}
              </FormField>
            </CardContent>
          </Card>

          {sortedSections.length > 0 ? (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Content by section</CardTitle>
                <CardDescription>
                  Fill in each section. They will be merged into one document (and you can download as PDF later).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {sortedSections.map((section) => (
                  <FormField key={section.key} label={section.label}>
                    <Textarea
                      rows={6}
                      placeholder={section.placeholder ?? undefined}
                      value={sectionContents[section.key] ?? ""}
                      onChange={(e) =>
                        setSectionContents((prev) => ({ ...prev, [section.key]: e.target.value }))
                      }
                    />
                  </FormField>
                ))}
                {contentError && <p className="text-sm text-destructive">{contentError}</p>}
              </CardContent>
            </Card>
          ) : (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Content</CardTitle>
                <CardDescription>
                  Write your statement of purpose. Or select a template above to write by sections.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FormField label="Content" error={contentError ?? undefined}>
                  <Textarea
                    rows={16}
                    placeholder="Write your statement of purpose here..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className={contentError ? "border-destructive" : ""}
                  />
                </FormField>
              </CardContent>
            </Card>
          )}

          <div className="flex gap-2">
            <Button type="submit" disabled={isSubmitting} className="bg-primary hover:bg-primary/90">
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Create SOP
                </>
              )}
            </Button>
            <Link href={cancelHref}>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}
