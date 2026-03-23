"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useToast } from "@/lib/hooks/useToast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form";
import { ArrowLeft, Save, Plus, Trash2, Loader2 } from "lucide-react";
import type { TemplateSection } from "@/lib/types/sopTemplate";

export default function EditSopTemplatePage() {
  const toast = useToast();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sections, setSections] = useState<TemplateSection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/sop-templates/${id}`);
        if (!response.ok) {
          if (response.status === 404) {
            toast.error("Template not found");
            router.push("/sop/templates");
            return;
          }
          throw new Error("Failed to load template");
        }
        const data = await response.json();
        setName(data.name);
        setDescription(data.description ?? "");
        setSections(Array.isArray(data.sections) ? data.sections : []);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load template");
        router.push("/sop/templates");
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [id, router, toast]);

  const addSection = () => {
    setSections((prev) => [
      ...prev,
      { key: `section_${Date.now()}`, label: "New section", placeholder: "", order: prev.length },
    ]);
  };

  const removeSection = (index: number) => {
    setSections((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.map((s, i) => ({ ...s, order: i }));
    });
  };

  const updateSection = (index: number, field: keyof TemplateSection, value: string | number) => {
    setSections((prev) => {
      const next = prev.map((s, i) =>
        i === index ? { ...s, [field]: value } : s
      );
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Template name is required");
      return;
    }
    if (sections.length === 0) {
      toast.error("Add at least one section");
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/sop-templates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          sections: sections.map((s, i) => ({ ...s, order: i })),
        }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to update template");
      }
      toast.success("Template updated");
      router.push(`/sop/templates/${id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update template");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <main className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
        <div className="max-w-3xl mx-auto flex items-center justify-center h-[60vh]">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Loading template...</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Link href={`/sop/templates/${id}`}>
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Edit SOP Template</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Update sections and details.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Template details</CardTitle>
              <CardDescription>Name and optional description.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField label="Name">
                <Input
                  placeholder="e.g. Graduate SOP"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </FormField>
              <FormField label="Description (optional)">
                <Textarea
                  placeholder="Brief description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                />
              </FormField>
            </CardContent>
          </Card>

          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Sections</CardTitle>
                  <CardDescription>
                    Order defines the final order in the document.
                  </CardDescription>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addSection}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add section
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {sections.map((section, index) => (
                <div key={index} className="p-4 border rounded-lg space-y-2">
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-sm font-medium text-muted-foreground">Section {index + 1}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => removeSection(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Input
                      placeholder="Key"
                      value={section.key}
                      onChange={(e) => updateSection(index, "key", e.target.value)}
                    />
                    <Input
                      placeholder="Label"
                      value={section.label}
                      onChange={(e) => updateSection(index, "label", e.target.value)}
                    />
                  </div>
                  <Input
                    placeholder="Placeholder (optional)"
                    value={section.placeholder ?? ""}
                    onChange={(e) => updateSection(index, "placeholder", e.target.value)}
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button type="submit" disabled={isSubmitting} className="bg-primary hover:bg-primary/90">
              {isSubmitting ? "Saving..." : <><Save className="h-4 w-4 mr-2" /> Save changes</>}
            </Button>
            <Link href={`/sop/templates/${id}`}>
              <Button type="button" variant="outline">Cancel</Button>
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}
