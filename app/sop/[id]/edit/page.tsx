"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
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
import { ArrowLeft, Loader2, Save, LayoutList, FileText } from "lucide-react";
import type { SOPSectionEntry } from "@/lib/types/sop";
import type { TemplateSection } from "@/lib/types/sopTemplate";
import {
  mergeSectionRecordToContent,
  smartSplitToSections,
} from "@/lib/utils/sop";

interface ApplicationOption {
  _id: string;
  name: string;
  university: string;
}

interface TemplateOption {
  _id: string;
  name: string;
  sections: TemplateSection[];
}

interface SOPData {
  _id: string;
  title: string;
  content: string;
  applicationId?: string | { _id: string };
  templateId?: string;
  sections?: SOPSectionEntry[];
}

export default function EditSOPPage() {
  const toast = useToast();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [applications, setApplications] = useState<ApplicationOption[]>([]);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [loadingApps, setLoadingApps] = useState(true);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [applicationId, setApplicationId] = useState<string | undefined>(undefined);
  const [templateId, setTemplateId] = useState<string | undefined>(undefined);
  const [sectionContents, setSectionContents] = useState<Record<string, string>>({});
  const [mergedContent, setMergedContent] = useState("");
  const [contentViewMode, setContentViewMode] = useState<"sections" | "merged">("sections");
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateOption | null>(null);
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
    const loadSOP = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/sop/${id}`);
        if (!response.ok) {
          if (response.status === 404) {
            toast.error("SOP not found");
            router.push("/sop");
            return;
          }
          throw new Error("Failed to load SOP");
        }
        const data: SOPData = await response.json();
        setTitle(data.title);
        setContent(data.content ?? "");
        const appId =
          data.applicationId && typeof data.applicationId === "object"
            ? data.applicationId._id
            : typeof data.applicationId === "string"
              ? data.applicationId
              : undefined;
        setApplicationId(appId);
        const tid =
          data.templateId && typeof data.templateId === "object" && "_id" in data.templateId
            ? (data.templateId as { _id: string })._id
            : (data.templateId as string | undefined);
        setTemplateId(tid);
        if (data.sections && data.sections.length > 0) {
          const map: Record<string, string> = {};
          data.sections.forEach((s) => {
            map[s.key] = s.content ?? "";
          });
          setSectionContents(map);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load SOP";
        toast.error(message);
        router.push("/sop");
      } finally {
        setIsLoading(false);
      }
    };
    loadSOP();
  }, [id, router, toast]);

  useEffect(() => {
    if (!templateId) {
      setSelectedTemplate(null);
      return;
    }
    const t = templates.find((x) => x._id === templateId);
    setSelectedTemplate(t ?? null);
  }, [templateId, templates]);

  const validate = (): boolean => {
    if (selectedTemplate && selectedTemplate.sections?.length) {
      const toCheck =
        contentViewMode === "merged"
          ? mergedContent.trim()
          : mergeSectionRecordToContent(
              sectionContents,
              sortedSections.map((s) => s.key)
            );
      if (toCheck.length < 10) {
        setContentError("Fill in at least 10 characters (in section or merged view)");
        return false;
      }
    } else {
      if ((content ?? "").trim().length < 10) {
        setContentError("Content is required (at least 10 characters)");
        return false;
      }
    }
    setContentError(null);
    return true;
  };

  const switchToMergedView = () => {
    setMergedContent(
      mergeSectionRecordToContent(
        sectionContents,
        sortedSections.map((s) => s.key)
      )
    );
    setContentViewMode("merged");
  };

  const switchToSectionView = () => {
    setSectionContents(
      smartSplitToSections(mergedContent, sortedSections.map((s) => s.key))
    );
    setContentViewMode("sections");
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsSubmitting(true);
    try {
      const body: {
        title: string;
        content?: string;
        applicationId?: string | null;
        templateId?: string | null;
        sections?: SOPSectionEntry[];
      } = {
        title: title.trim(),
        applicationId: applicationId || null,
      };
      if (selectedTemplate && selectedTemplate.sections?.length) {
        body.templateId = templateId ?? null;
        const sorted = [...selectedTemplate.sections].sort((a, b) => a.order - b.order);
        const keys = sorted.map((s) => s.key);
        const contentsToSend =
          contentViewMode === "merged"
            ? smartSplitToSections(mergedContent, keys)
            : sectionContents;
        body.sections = sorted.map((s) => ({
          key: s.key,
          content: (contentsToSend[s.key] ?? "").trim(),
        }));
      } else {
        body.content = content.trim();
      }

      const response = await fetch(`/api/sop/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to update SOP");
      }
      toast.success("SOP updated successfully");
      router.push(`/sop/${id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update SOP";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const sortedSections = selectedTemplate
    ? [...(selectedTemplate.sections || [])].sort((a, b) => a.order - b.order)
    : [];
  const useSectionedForm = selectedTemplate && sortedSections.length > 0;
  const sectionKeys = sortedSections.map((s) => s.key);

  if (isLoading) {
    return (
      <main className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
        <div className="max-w-3xl mx-auto flex items-center justify-center h-[60vh]">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Loading SOP...</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Link href={`/sop/${id}`}>
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Edit Statement of Purpose</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Update the SOP details and optional link.
            </p>
          </div>
        </div>

        <form onSubmit={onSubmit}>
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>SOP Details</CardTitle>
              <CardDescription>
                Edit title, application link, and template. Content can be sectioned or freeform.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField label="Title">
                <Input
                  placeholder="e.g. Stanford University – CS PhD"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </FormField>

              <FormField label="Base template">
                <Select
                  value={templateId ?? "none"}
                  onValueChange={(v) => {
                    setTemplateId(v === "none" ? undefined : v);
                    const t = templates.find((x) => x._id === v);
                    if (t && t.sections?.length) {
                      setSelectedTemplate(t);
                      setSectionContents((prev) => {
                        const next: Record<string, string> = {};
                        t.sections.forEach((s) => {
                          next[s.key] = prev[s.key] ?? "";
                        });
                        return next;
                      });
                    } else {
                      setSelectedTemplate(null);
                    }
                  }}
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
              </FormField>

              <FormField label="Link to application (optional)">
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
              </FormField>
            </CardContent>
          </Card>

          {useSectionedForm ? (
            <Card className="mb-6">
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <CardTitle>Content</CardTitle>
                    <CardDescription>
                      Toggle between section view (easier to maintain) and single merged view. Section data is kept when switching to merged; switching back to section re-splits the merged text by paragraphs.
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={contentViewMode === "sections" ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        if (contentViewMode === "merged") switchToSectionView();
                        else setContentViewMode("sections");
                      }}
                    >
                      <LayoutList className="h-4 w-4 mr-2" />
                      By section
                    </Button>
                    <Button
                      type="button"
                      variant={contentViewMode === "merged" ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        if (contentViewMode === "sections") switchToMergedView();
                        else setContentViewMode("merged");
                      }}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Merged
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {contentViewMode === "sections" ? (
                  <>
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
                  </>
                ) : (
                  <FormField label="Merged content (paragraphs separated by blank lines)" error={contentError ?? undefined}>
                    <Textarea
                      rows={20}
                      placeholder="Edit as one document. Switch back to By section to re-split by paragraphs."
                      value={mergedContent}
                      onChange={(e) => setMergedContent(e.target.value)}
                      className={contentError ? "border-destructive" : ""}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Section data is preserved until you switch to &quot;By section&quot; — then the text above is split by paragraphs into sections.
                    </p>
                  </FormField>
                )}
                {contentError && <p className="text-sm text-destructive">{contentError}</p>}
              </CardContent>
            </Card>
          ) : (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Content</CardTitle>
                <CardDescription>
                  Edit the full statement of purpose text.
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
                  Updating...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Update SOP
                </>
              )}
            </Button>
            <Link href={`/sop/${id}`}>
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
