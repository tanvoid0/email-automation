"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useToast } from "@/lib/hooks/useToast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form";
import { ArrowLeft, Save, Plus, Trash2 } from "lucide-react";
import type { TemplateSection } from "@/lib/types/sopTemplate";

const defaultSections: TemplateSection[] = [
  { key: "opening", label: "Opening / Introduction", placeholder: "Dear committee, I am...", order: 0 },
  { key: "about_you", label: "About you / Background", placeholder: "Education, GPA, scholarships...", order: 1 },
  { key: "experience", label: "Experience & skills", placeholder: "Lab work, tools, projects...", order: 2 },
  { key: "research_achievements", label: "Research & achievements", placeholder: "Papers, awards, competitions...", order: 3 },
  { key: "why_field", label: "Why this field / Professional development", placeholder: "Goals, motivation...", order: 4 },
  { key: "why_university", label: "Why this university", placeholder: "Curriculum, location, fit...", order: 5 },
  { key: "why_location", label: "Why this location / Personal fit", placeholder: "Optional...", order: 6 },
  { key: "conclusion", label: "Conclusion", placeholder: "Summary and closing...", order: 7 },
  { key: "sign_off", label: "Sign-off", placeholder: "Sincerely, [Your name]", order: 8 },
];

export default function NewSopTemplatePage() {
  const toast = useToast();
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sections, setSections] = useState<TemplateSection[]>(defaultSections);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    setSections((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s))
    );
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
      const response = await fetch("/api/sop-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          sections: sections.map((s, i) => ({ ...s, order: i })),
        }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to create template");
      }
      const created = await response.json();
      toast.success("Template created");
      router.push(`/sop/templates/${created._id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create template");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/sop/templates">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">New SOP Template</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Define sections that will appear when creating an SOP from this template.
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
              <FormField label="Name" error={!name.trim() ? undefined : undefined}>
                <Input
                  placeholder="e.g. Graduate SOP"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </FormField>
              <FormField label="Description (optional)">
                <Textarea
                  placeholder="Brief description of this template"
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
                    Each section becomes a labeled paragraph in the SOP. Order defines the final order in the document.
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
                      placeholder="Key (e.g. about_you)"
                      value={section.key}
                      onChange={(e) => updateSection(index, "key", e.target.value)}
                    />
                    <Input
                      placeholder="Label (e.g. About you)"
                      value={section.label}
                      onChange={(e) => updateSection(index, "label", e.target.value)}
                    />
                  </div>
                  <Input
                    placeholder="Placeholder hint (optional)"
                    value={section.placeholder ?? ""}
                    onChange={(e) => updateSection(index, "placeholder", e.target.value)}
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button type="submit" disabled={isSubmitting} className="bg-primary hover:bg-primary/90">
              {isSubmitting ? "Creating..." : <><Save className="h-4 w-4 mr-2" /> Create template</>}
            </Button>
            <Link href="/sop/templates">
              <Button type="button" variant="outline">Cancel</Button>
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}
