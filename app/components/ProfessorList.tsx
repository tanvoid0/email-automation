"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Send, CheckCircle2, XCircle, Clock, Pencil, Trash2, RotateCw } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export interface Professor {
  id: string;
  name: string;
  university: string;
  email: string;
  emailText: string;
  status: "pending" | "sending" | "sent" | "error";
  error?: string;
}

interface ProfessorListProps {
  professors: Professor[];
  onSendEmail: (professor: Professor) => Promise<void>;
  onBulkSend: (professorIds: string[]) => Promise<void>;
  onRemove: (id: string) => void;
  bulkSendProgress: {
    total: number;
    sent: number;
    inProgress: boolean;
  } | null;
}

export function ProfessorList({
  professors,
  onSendEmail,
  onBulkSend,
  onRemove,
  bulkSendProgress,
}: ProfessorListProps) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkSending, setIsBulkSending] = useState(false);
  const [statusFilter, setStatusFilter] = useState<Set<Professor["status"]>>(
    new Set(["pending", "sending", "sent", "error"])
  );

  // Filter professors based on status filter
  const filteredProfessors = professors.filter((p) => statusFilter.has(p.status));

  // Get all unsent professor IDs
  const unsentProfessorIds = professors
    .filter((p) => p.status === "pending")
    .map((p) => p.id);

  const toggleStatusFilter = (status: Professor["status"]) => {
    setStatusFilter((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(status)) {
        newSet.delete(status);
      } else {
        newSet.add(status);
      }
      return newSet;
    });
  };

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleAll = () => {
    const filteredIds = filteredProfessors.map((p: Professor) => p.id);
    const allSelected = filteredIds.every((id: string) => selectedIds.has(id));
    
    if (allSelected && filteredIds.length > 0) {
      // Deselect all filtered
      setSelectedIds((prev) => {
        const newSet = new Set(prev);
        filteredIds.forEach((id: string) => newSet.delete(id));
        return newSet;
      });
    } else {
      // Select all filtered
      setSelectedIds((prev) => {
        const newSet = new Set(prev);
        filteredIds.forEach((id: string) => newSet.add(id));
        return newSet;
      });
    }
  };

  const handleSendAllUnsent = async () => {
    if (unsentProfessorIds.length === 0) {
      toast.error("No unsent emails to send");
      return;
    }

    if (bulkSendProgress?.inProgress) {
      toast.error("Bulk send already in progress");
      return;
    }

    setIsBulkSending(true);
    try {
      await onBulkSend(unsentProfessorIds);
    } catch (error: any) {
      toast.error(`Error sending emails: ${error.message}`);
    } finally {
      setIsBulkSending(false);
    }
  };

  const handleBulkSend = async () => {
    if (selectedIds.size === 0) {
      toast.error("Please select at least one professor");
      return;
    }

    if (bulkSendProgress?.inProgress) {
      toast.error("Bulk send already in progress");
      return;
    }

    setIsBulkSending(true);
    try {
      await onBulkSend(Array.from(selectedIds));
      setSelectedIds(new Set());
    } catch (error: any) {
      toast.error(`Error sending emails: ${error.message}`);
    } finally {
      setIsBulkSending(false);
    }
  };

  const getStatusIcon = (status: Professor["status"]) => {
    switch (status) {
      case "sent":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "error":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "sending":
        return <Clock className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return null;
    }
  };

  if (professors.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No professors added yet. Use the form above to add professors.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Professors ({professors.length})</CardTitle>
            <CardDescription>
              Select professors and send emails in bulk
            </CardDescription>
          </div>
          {professors.length > 0 && (
            <div className="flex gap-2">
              <Button
                onClick={toggleAll}
                variant="outline"
                size="sm"
              >
                {selectedIds.size === filteredProfessors.length && filteredProfessors.length > 0
                  ? "Deselect All"
                  : "Select All"}
              </Button>
              <Button
                onClick={handleBulkSend}
                disabled={isBulkSending || selectedIds.size === 0 || (bulkSendProgress?.inProgress ?? false)}
                size="sm"
              >
                {isBulkSending || (bulkSendProgress?.inProgress ?? false) ? (
                  "Sending..."
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send Selected ({selectedIds.size})
                  </>
                )}
              </Button>
              {unsentProfessorIds.length > 0 && (
                <Button
                  onClick={handleSendAllUnsent}
                  disabled={isBulkSending || (bulkSendProgress?.inProgress ?? false)}
                  size="sm"
                  variant="default"
                >
                  {isBulkSending || (bulkSendProgress?.inProgress ?? false) ? (
                    "Sending..."
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Send All Unsent ({unsentProfessorIds.length})
                    </>
                  )}
                </Button>
              )}
            </div>
          )}
        </div>
        {bulkSendProgress && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {bulkSendProgress.inProgress
                  ? `Sending emails... (${bulkSendProgress.sent}/${bulkSendProgress.total})`
                  : `Completed: ${bulkSendProgress.sent}/${bulkSendProgress.total} emails sent`}
              </span>
              <span className="font-medium">
                {Math.round((bulkSendProgress.sent / bulkSendProgress.total) * 100)}%
              </span>
            </div>
            <Progress
              value={(bulkSendProgress.sent / bulkSendProgress.total) * 100}
              className="h-2"
            />
          </div>
        )}
        <div className="mt-4 flex items-center gap-6">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium">Filter by status:</span>
            <div className="flex items-center gap-4">
              {(["pending", "sending", "sent", "error"] as const).map((status) => (
                <div key={status} className="flex items-center space-x-2">
                  <Checkbox
                    id={`filter-${status}`}
                    checked={statusFilter.has(status)}
                    onCheckedChange={() => toggleStatusFilter(status)}
                  />
                  <label
                    htmlFor={`filter-${status}`}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer capitalize"
                  >
                    {status}
                  </label>
                </div>
              ))}
            </div>
          </div>
          {statusFilter.size < 4 && (
            <span className="text-sm text-muted-foreground">
              Showing {filteredProfessors.length} of {professors.length} professors
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedIds.size === filteredProfessors.length && filteredProfessors.length > 0}
                    onCheckedChange={toggleAll}
                  />
                </TableHead>
                <TableHead>Name</TableHead>
                <TableHead>University</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProfessors.map((professor) => (
                <TableRow key={professor.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(professor.id)}
                      onCheckedChange={() => toggleSelection(professor.id)}
                      disabled={professor.status === "sending"}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{professor.name}</TableCell>
                  <TableCell>{professor.university}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {professor.email}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(professor.status)}
                      <span className="text-sm capitalize">{professor.status}</span>
                    </div>
                    {professor.error && (
                      <div className="text-xs text-red-500 mt-1">
                        {professor.error}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {professor.status === "pending" && (
                        <Button
                          onClick={() => onSendEmail(professor)}
                          size="sm"
                          variant="outline"
                          title="Send email"
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                      )}
                      {professor.status === "error" && (
                        <Button
                          onClick={() => onSendEmail(professor)}
                          size="sm"
                          variant="outline"
                          title="Retry sending email"
                        >
                          <RotateCw className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        onClick={() => router.push(`/professors/${professor.id}/edit`)}
                        size="sm"
                        variant="outline"
                        title="Edit professor"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        onClick={() => {
                          toast.error(`Delete ${professor.name}?`, {
                            description: "This action cannot be undone.",
                            action: {
                              label: "Delete",
                              onClick: () => onRemove(professor.id),
                            },
                            cancel: {
                              label: "Cancel",
                              onClick: () => {},
                            },
                            duration: 5000,
                          });
                        }}
                        size="sm"
                        variant="ghost"
                        title="Remove professor"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

