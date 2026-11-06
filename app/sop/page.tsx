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
import { FileText, Plus, Pencil, Trash2, Loader2, ExternalLink } from "lucide-react";

interface ApplicationRef {
  _id: string;
  name: string;
  university: string;
}

interface AdmissionRef {
  _id: string;
  universityName: string;
  programName?: string;
}

interface SOPItem {
  _id: string;
  title: string;
  content: string;
  applicationId?: string | ApplicationRef;
  admissionApplicationId?: string | AdmissionRef;
  updatedAt?: string;
}

export default function SOPListPage() {
  const toast = useToast();
  const router = useRouter();
  const [sops, setSops] = useState<SOPItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSOPs();
  }, []);

  const loadSOPs = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/sop");
      if (!response.ok) throw new Error("Failed to load SOPs");
      const data = await response.json();
      setSops(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load SOPs";
      toast.error(`Error loading SOPs: ${message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to delete "${title}"?`)) return;
    try {
      const response = await fetch(`/api/sop/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete");
      }
      toast.success("SOP deleted successfully");
      await loadSOPs();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete SOP";
      toast.error(message);
    }
  };

  const getLinkedLabel = (sop: SOPItem) => {
    const adm = sop.admissionApplicationId;
    if (adm) {
      if (typeof adm === "object" && adm !== null && "universityName" in adm) {
        const prog = adm.programName ? ` – ${adm.programName}` : "";
        return {
          label: `Admission: ${adm.universityName}${prog}`,
          href: `/admissions/${adm._id}`,
        };
      }
      return { label: "Admission (linked)", href: `/admissions/${adm}` };
    }
    const app = sop.applicationId;
    if (!app) return { label: "Standalone", href: null };
    if (typeof app === "object" && app !== null && "name" in app) {
      return {
        label: `Email app: ${app.name} – ${app.university}`,
        href: `/applications/${app._id}`,
      };
    }
    return { label: "Email app (linked)", href: `/applications/${app}` };
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[50dvh] items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading SOPs...</p>
        </div>
      </div>
    );
  }

  const linkedNode = (label: string, href: string | null) =>
    href ? (
      <Link href={href} className="text-primary hover:underline inline-flex items-center gap-1 min-w-0">
        <span className="break-words">{label}</span>
        <ExternalLink className="h-3 w-3 shrink-0" />
      </Link>
    ) : (
      <span className="text-muted-foreground">{label}</span>
    );

  const rowActions = (sop: SOPItem) => (
    <>
      <Button variant="outline" size="sm" className="h-10" onClick={() => router.push(`/sop/${sop._id}`)}>
        View
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="h-10 w-10 p-0"
        aria-label={`Edit ${sop.title}`}
        onClick={() => router.push(`/sop/${sop._id}/edit`)}
      >
        <Pencil className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="h-10 w-10 p-0 text-destructive hover:text-destructive"
        aria-label={`Delete ${sop.title}`}
        onClick={() => handleDelete(sop._id, sop.title)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </>
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
        <PageHeader
          title="Statements of Purpose"
          description="Manage SOPs for university applications. Link to an application or keep them standalone."
          actions={
            <>
              <Link href="/sop/templates">
                <Button variant="outline">
                  <FileText className="h-4 w-4 mr-2" />
                  Templates
                </Button>
              </Link>
              <Link href="/sop/new">
                <Button className="bg-primary hover:bg-primary/90">
                  <Plus className="h-4 w-4 mr-2" />
                  New SOP
                </Button>
              </Link>
            </>
          }
        />

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">All SOPs</CardTitle>
            <CardDescription>
              View, edit, or delete. Click a row to view details.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sops.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium">No SOPs yet</p>
                <p className="text-sm mt-1">Create your first Statement of Purpose to get started.</p>
                <Link href="/sop/new">
                  <Button className="mt-4">Create SOP</Button>
                </Link>
              </div>
            ) : (
              <>
                <ul className="space-y-3 md:hidden">
                  {sops.map((sop) => {
                    const { label, href } = getLinkedLabel(sop);
                    return (
                      <li key={sop._id} className="space-y-3 rounded-lg border p-3">
                        <div className="min-w-0 space-y-1">
                          <Link
                            href={`/sop/${sop._id}`}
                            className="block break-words font-medium text-primary hover:underline"
                          >
                            {sop.title}
                          </Link>
                          <div className="text-sm">{linkedNode(label, href)}</div>
                        </div>
                        <div className="flex flex-wrap gap-2">{rowActions(sop)}</div>
                      </li>
                    );
                  })}
                </ul>
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Linked to</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sops.map((sop) => {
                        const { label, href } = getLinkedLabel(sop);
                        return (
                          <TableRow key={sop._id}>
                            <TableCell className="max-w-xs">
                              <Link
                                href={`/sop/${sop._id}`}
                                className="block break-words font-medium text-primary hover:underline"
                              >
                                {sop.title}
                              </Link>
                            </TableCell>
                            <TableCell>{linkedNode(label, href)}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">{rowActions(sop)}</div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
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
