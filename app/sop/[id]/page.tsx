"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useToast } from "@/lib/hooks/useToast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Pencil, Trash2, Loader2, ExternalLink, FileDown, LayoutList, FileText } from "lucide-react";
import { downloadSOPAsPDF } from "@/lib/utils/sop-pdf";
import { smartSplitToSections } from "@/lib/utils/sop";

interface ApplicationRef {
  _id: string;
  name: string;
  university: string;
}

interface SOPDetail {
  _id: string;
  title: string;
  content: string;
  applicationId?: string | ApplicationRef;
  templateId?: string;
  sections?: { key: string; content: string }[];
  updatedAt?: string;
}

interface TemplateSection {
  key: string;
  label: string;
  order: number;
}

export default function ViewSOPPage() {
  const toast = useToast();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [sop, setSop] = useState<SOPDetail | null>(null);
  const [template, setTemplate] = useState<{ sections: TemplateSection[] } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDownloadingPDF, setIsDownloadingPDF] = useState(false);
  const [contentViewMode, setContentViewMode] = useState<"sections" | "merged">("merged");

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/sop/${id}`);
        if (!response.ok) {
          if (response.status === 404) {
            setSop(null);
            return;
          }
          throw new Error("Failed to load SOP");
        }
        const data = await response.json();
        setSop(data);
        const tid =
          data.templateId && typeof data.templateId === "object" && "_id" in data.templateId
            ? (data.templateId as { _id: string })._id
            : (data.templateId as string | undefined);
        if (tid) {
          try {
            const tRes = await fetch(`/api/sop-templates/${tid}`);
            if (tRes.ok) {
              const tData = await tRes.json();
              setTemplate(tData);
            }
          } catch {
            // ignore
          }
        } else {
          setTemplate(null);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load SOP";
        toast.error(message);
        setSop(null);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [id, toast]);

  const handleDownloadPDF = () => {
    if (!sop) return;
    setIsDownloadingPDF(true);
    try {
      const contentToUse =
        sop.content ||
        (sop.sections && sop.sections.length > 0
          ? sop.sections.map((s) => (s.content || "").trim()).filter(Boolean).join("\n\n")
          : "");
      downloadSOPAsPDF(sop.title, contentToUse, sop.title);
      toast.success("Use the print dialog to save as PDF");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to open print dialog";
      toast.error(message);
    } finally {
      setIsDownloadingPDF(false);
    }
  };

  const handleDelete = async () => {
    if (!sop || !confirm(`Are you sure you want to delete "${sop.title}"?`)) return;
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/sop/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete");
      }
      toast.success("SOP deleted successfully");
      router.push("/sop");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete SOP";
      toast.error(message);
    } finally {
      setIsDeleting(false);
    }
  };

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

  if (!sop) {
    return (
      <main className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
        <div className="max-w-3xl mx-auto">
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground mb-4">SOP not found.</p>
              <Link href="/sop">
                <Button variant="outline">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to SOPs
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  const app = sop.applicationId;
  const linkedHref =
    app && typeof app === "object" && "name" in app
      ? `/applications/${app._id}`
      : typeof app === "string"
        ? `/applications/${app}`
        : null;
  const linkedLabel =
    app && typeof app === "object" && "name" in app
      ? `${app.name} – ${app.university}`
      : app
        ? "Linked application"
        : "Standalone";

  const mergedText =
    sop.content ||
    (sop.sections && sop.sections.length > 0
      ? sop.sections
          .map((s) => (s.content || "").trim())
          .filter(Boolean)
          .join("\n\n")
      : "");
  const sortedTemplateSections = template?.sections
    ? [...template.sections].sort((a, b) => a.order - b.order)
    : [];
  const sectionKeysFromTemplate = sortedTemplateSections.map((s) => s.key);
  const sectionKeys =
    sectionKeysFromTemplate.length > 0
      ? sectionKeysFromTemplate
      : sop.sections?.map((s) => s.key) ?? [];
  const hasSectionView =
    (sop.sections && sop.sections.length > 0) || (mergedText.length > 0 && sectionKeys.length > 0);
  const sectionContentsForView: Record<string, string> =
    sop.sections && sop.sections.length > 0
      ? Object.fromEntries(sop.sections.map((s) => [s.key, s.content ?? ""]))
      : sectionKeys.length > 0
        ? smartSplitToSections(mergedText, sectionKeys)
        : {};
  const displayMerged =
    contentViewMode === "merged"
      ? mergedText
      : sectionKeys
          .map((k) => (sectionContentsForView[k] ?? "").trim())
          .filter(Boolean)
          .join("\n\n");
  const sectionLabels = new Map(sortedTemplateSections.map((s) => [s.key, s.label]));

  return (
    <main className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/sop">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">{sop.title}</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {linkedHref ? (
                  <Link href={linkedHref} className="text-primary hover:underline inline-flex items-center gap-1">
                    {linkedLabel}
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                ) : (
                  linkedLabel
                )}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadPDF}
              disabled={isDownloadingPDF}
            >
              {isDownloadingPDF ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileDown className="h-4 w-4 mr-2" />
              )}
              Download PDF
            </Button>
            <Link href={`/sop/${id}/edit`}>
              <Button variant="outline" size="sm">
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </>
              )}
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <CardTitle>Content</CardTitle>
                <CardDescription>
                  View by section or as a single merged document.
                </CardDescription>
              </div>
              {hasSectionView && (
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={contentViewMode === "sections" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setContentViewMode("sections")}
                  >
                    <LayoutList className="h-4 w-4 mr-2" />
                    By section
                  </Button>
                  <Button
                    type="button"
                    variant={contentViewMode === "merged" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setContentViewMode("merged")}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Merged
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {contentViewMode === "sections" && sectionKeys.length > 0 ? (
              <div className="space-y-6">
                {sectionKeys.map((key) => (
                  <div key={key}>
                    <h3 className="text-sm font-medium text-muted-foreground mb-2">
                      {sectionLabels.get(key) ?? key}
                    </h3>
                    <div className="whitespace-pre-wrap text-sm">{sectionContentsForView[key] || "—"}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="whitespace-pre-wrap text-sm">{displayMerged || sop.content}</div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
