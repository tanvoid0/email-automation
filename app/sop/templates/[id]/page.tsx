"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useToast } from "@/lib/hooks/useToast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Pencil, Loader2 } from "lucide-react";

interface TemplateSection {
  key: string;
  label: string;
  placeholder?: string;
  order: number;
}

interface TemplateDetail {
  _id: string;
  name: string;
  description?: string;
  sections: TemplateSection[];
}

export default function ViewSopTemplatePage() {
  const toast = useToast();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [template, setTemplate] = useState<TemplateDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/sop-templates/${id}`);
        if (!response.ok) {
          if (response.status === 404) setTemplate(null);
          else throw new Error("Failed to load template");
          return;
        }
        const data = await response.json();
        setTemplate(data);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load template");
        setTemplate(null);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [id, toast]);

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

  if (!template) {
    return (
      <main className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
        <div className="max-w-3xl mx-auto">
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground mb-4">Template not found.</p>
              <Link href="/sop/templates">
                <Button variant="outline">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to templates
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  const sortedSections = [...(template.sections || [])].sort((a, b) => a.order - b.order);

  return (
    <main className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/sop/templates">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">{template.name}</h1>
              {template.description && (
                <p className="text-sm text-muted-foreground mt-1">{template.description}</p>
              )}
            </div>
          </div>
          <Link href={`/sop/templates/${id}/edit`}>
            <Button variant="outline" size="sm">
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sections</CardTitle>
            <CardDescription>
              These sections will appear when creating an SOP from this template.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal list-inside space-y-3">
              {sortedSections.map((s, i) => (
                <li key={i} className="text-sm">
                  <span className="font-medium">{s.label}</span>
                  <span className="text-muted-foreground"> ({s.key})</span>
                  {s.placeholder && (
                    <p className="text-muted-foreground text-xs mt-1 ml-4">{s.placeholder}</p>
                  )}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
