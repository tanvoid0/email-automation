"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useToast } from "@/lib/hooks/useToast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/app/components/PageHeader";
import { FileStack, Plus, Pencil, Trash2, Loader2 } from "lucide-react";

interface TemplateSection {
  key: string;
  label: string;
  placeholder?: string;
  order: number;
}

interface TemplateItem {
  _id: string;
  name: string;
  description?: string;
  sections: TemplateSection[];
  updatedAt?: string;
}

export default function SopTemplatesListPage() {
  const toast = useToast();
  const router = useRouter();
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/sop-templates");
      if (!response.ok) throw new Error("Failed to load templates");
      const data = await response.json();
      setTemplates(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load templates";
      toast.error(`Error: ${message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete template "${name}"? This will not delete SOPs that used it.`)) return;
    try {
      const response = await fetch(`/api/sop-templates/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete");
      }
      toast.success("Template deleted");
      await loadTemplates();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[50dvh] items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading templates...</p>
        </div>
      </div>
    );
  }

  const rowActions = (t: TemplateItem) => (
    <>
      <Button variant="outline" size="sm" className="h-10" onClick={() => router.push(`/sop/templates/${t._id}`)}>
        View
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="h-10 w-10 p-0"
        aria-label={`Edit ${t.name}`}
        onClick={() => router.push(`/sop/templates/${t._id}/edit`)}
      >
        <Pencil className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="h-10 w-10 p-0 text-destructive hover:text-destructive"
        aria-label={`Delete ${t.name}`}
        onClick={() => handleDelete(t._id, t.name)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </>
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
        <PageHeader
          title="SOP Templates"
          description="Define section-based templates. New SOPs can use a template as the base."
          backHref="/sop"
          actions={
            <Link href="/sop/templates/new">
              <Button className="bg-primary hover:bg-primary/90">
                <Plus className="h-4 w-4 mr-2" />
                New Template
              </Button>
            </Link>
          }
        />

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Templates</CardTitle>
            <CardDescription>
              Each template has named sections (e.g. About you, Why this university). When creating an SOP, you can pick a template and fill each section.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {templates.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileStack className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium">No templates yet</p>
                <p className="text-sm mt-1">Create a template with sections to use when writing SOPs.</p>
                <Link href="/sop/templates/new">
                  <Button className="mt-4">Create Template</Button>
                </Link>
              </div>
            ) : (
              <>
                <ul className="space-y-3 md:hidden">
                  {templates.map((t) => (
                    <li key={t._id} className="space-y-3 rounded-lg border p-3">
                      <div className="min-w-0">
                        <Link
                          href={`/sop/templates/${t._id}`}
                          className="block break-words font-medium text-primary hover:underline"
                        >
                          {t.name}
                        </Link>
                        {t.description && (
                          <p className="mt-0.5 break-words text-sm text-muted-foreground">{t.description}</p>
                        )}
                        <p className="mt-1 text-sm text-muted-foreground">{t.sections?.length ?? 0} sections</p>
                      </div>
                      <div className="flex flex-wrap gap-2">{rowActions(t)}</div>
                    </li>
                  ))}
                </ul>
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Sections</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {templates.map((t) => (
                        <TableRow key={t._id}>
                          <TableCell className="max-w-md">
                            <Link
                              href={`/sop/templates/${t._id}`}
                              className="block break-words font-medium text-primary hover:underline"
                            >
                              {t.name}
                            </Link>
                            {t.description && (
                              <p className="mt-0.5 break-words text-sm text-muted-foreground">{t.description}</p>
                            )}
                          </TableCell>
                          <TableCell>{t.sections?.length ?? 0} sections</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">{rowActions(t)}</div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
    </div>
  );
}
