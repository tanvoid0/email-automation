"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Send, CheckCircle2, XCircle, Clock, Pencil, Trash2, RotateCw, Paperclip, CheckSquare, Square, Mail, Eye, File, X, RefreshCw, Ban } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { StatusFilter } from "./StatusFilter";
import { AttachmentPreview } from "./AttachmentPreview";
import { cn } from "@/lib/utils";
import type { Application, ApplicationAttachment } from "@/lib/types/application";
import type { ApiErrorResponse } from "@/lib/types/api";
import { getErrorMessage } from "@/lib/types/errors";

// Re-export for backward compatibility
export type { Application };

interface ApplicationListProps {
  applications: Application[];
  onSendEmail: (application: Application) => Promise<void>;
  onBulkSend: (applicationIds: string[]) => Promise<void>;
  onRemove: (id: string) => void;
  onAttachmentsUpdated?: () => void;
  isQueueProcessing?: boolean;
}

interface Attachment {
  _id: string;
  filename: string;
  contentType?: string;
  size?: number;
}

export function ApplicationList({
  applications,
  onSendEmail,
  onBulkSend,
  onRemove,
  onAttachmentsUpdated,
  isQueueProcessing = false,
}: ApplicationListProps) {
  const toast = useToast();
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkSending, setIsBulkSending] = useState(false);
  const [statusFilter, setStatusFilter] = useState<Set<Application["status"]>>(
    new Set(["pending", "sending", "sent", "error", "cancelled"])
  );
  const [isCancellingStuck, setIsCancellingStuck] = useState(false);
  const [isAttachDialogOpen, setIsAttachDialogOpen] = useState(false);
  const [availableAttachments, setAvailableAttachments] = useState<Attachment[]>([]);
  const [selectedAttachmentIds, setSelectedAttachmentIds] = useState<Set<string>>(new Set());
  const [isLoadingAttachments, setIsLoadingAttachments] = useState(false);
  const [isAttaching, setIsAttaching] = useState(false);

  // Filter applications based on status filter
  const filteredApplications = applications.filter((p) => statusFilter.has(p.status));

  // Get all unsent application IDs (pending or error)
  const unsentApplicationIds = applications
    .filter((p) => p.status === "pending" || p.status === "error")
    .map((p) => p.id);

  // Get all sent application IDs
  const sentApplicationIds = applications
    .filter((p) => p.status === "sent")
    .map((p) => p.id);

  const toggleStatusFilter = (status: Application["status"]) => {
    setStatusFilter((prev) => {
      // If clicking the same status that's already selected, deselect it
      if (prev.has(status) && prev.size === 1) {
        return new Set();
      }
      // Otherwise, select only this status (single select)
      return new Set([status]);
    });
  };

  const selectAllStatuses = () => {
    setStatusFilter(new Set(["pending", "sending", "sent", "error", "cancelled"]));
  };

  // Get stuck applications (status: "sending")
  const stuckApplicationIds = applications
    .filter((p) => p.status === "sending")
    .map((p) => p.id);

  const handleCancelStuck = async () => {
    if (stuckApplicationIds.length === 0) {
      toast.info("No stuck applications found");
      return;
    }

    setIsCancellingStuck(true);
    try {
      const response = await fetch("/api/applications/cancel-stuck", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData: ApiErrorResponse = await response.json();
        throw new Error(errorData.error || "Failed to cancel stuck applications");
      }

      const result = await response.json();
      toast.success(`Cancelled ${result.cancelledCount} stuck application(s)`, {
        title: "Stuck Applications Cancelled",
        persist: false,
      });

      // Reload the page to refresh application list
      window.location.reload();
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      toast.error(`Failed to cancel stuck applications: ${errorMessage}`);
    } finally {
      setIsCancellingStuck(false);
    }
  };

  const clearAllStatuses = () => {
    setStatusFilter(new Set());
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
    const filteredIds = filteredApplications.map((p: Application) => p.id);
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

  const selectAllUnsent = () => {
    if (unsentApplicationIds.length === 0) {
      return;
    }
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      unsentApplicationIds.forEach((id: string) => newSet.add(id));
      return newSet;
    });
  };

  const selectAllSent = () => {
    if (sentApplicationIds.length === 0) {
      return;
    }
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      sentApplicationIds.forEach((id: string) => newSet.add(id));
      return newSet;
    });
  };

  const handleSendAllUnsent = async () => {
    if (unsentApplicationIds.length === 0) {
      toast.error("No unsent emails to send");
      return;
    }

    if (isQueueProcessing) {
      toast.error("Email queue is already processing");
      return;
    }

    setIsBulkSending(true);
    try {
      await onBulkSend(unsentApplicationIds);
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      toast.error(`Error sending emails: ${errorMessage}`);
    } finally {
      setIsBulkSending(false);
    }
  };

  const handleBulkSend = async () => {
    if (selectedIds.size === 0) {
      toast.error("Please select at least one application");
      return;
    }

    if (isQueueProcessing) {
      toast.error("Email queue is already processing");
      return;
    }

    setIsBulkSending(true);
    try {
      await onBulkSend(Array.from(selectedIds));
      setSelectedIds(new Set());
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      toast.error(`Error sending emails: ${errorMessage}`);
    } finally {
      setIsBulkSending(false);
    }
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) {
      return;
    }

    const count = selectedIds.size;
    toast.error(`Delete ${count} selected application${count > 1 ? 's' : ''}?`, {
      description: "This action cannot be undone.",
      action: {
        label: "Delete",
        onClick: () => {
          const idsToDelete = Array.from(selectedIds);
          idsToDelete.forEach((id) => onRemove(id));
          setSelectedIds(new Set());
          toast.success(`${count} application${count > 1 ? 's' : ''} deleted successfully`);
        },
      },
      cancel: {
        label: "Cancel",
        onClick: () => {},
      },
      duration: 5000,
    });
  };

  const loadAttachments = async () => {
    try {
      setIsLoadingAttachments(true);
      const response = await fetch("/api/attachments");
      if (!response.ok) {
        throw new Error("Failed to load attachments");
      }
      const data: Attachment[] = await response.json();
      setAvailableAttachments(data);
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      toast.error(`Error loading attachments: ${errorMessage}`);
    } finally {
      setIsLoadingAttachments(false);
    }
  };

  const handleOpenAttachDialog = () => {
    if (selectedIds.size === 0) {
      toast.error("Please select at least one application");
      return;
    }
    setSelectedAttachmentIds(new Set());
    setIsAttachDialogOpen(true);
    loadAttachments();
  };

  const handleCloseAttachDialog = () => {
    setIsAttachDialogOpen(false);
    setSelectedAttachmentIds(new Set());
  };

  const toggleAttachmentSelection = (attachmentId: string) => {
    const newSelected = new Set(selectedAttachmentIds);
    if (newSelected.has(attachmentId)) {
      newSelected.delete(attachmentId);
    } else {
      newSelected.add(attachmentId);
    }
    setSelectedAttachmentIds(newSelected);
  };

  const handleAttachToSelected = async () => {
    if (selectedIds.size === 0) {
      toast.error("Please select at least one application");
      return;
    }

    if (selectedAttachmentIds.size === 0) {
      toast.error("Please select at least one attachment");
      return;
    }

    try {
      setIsAttaching(true);
      const response = await fetch("/api/applications/bulk-attach", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          applicationIds: Array.from(selectedIds),
          attachmentIds: Array.from(selectedAttachmentIds),
        }),
      });

      if (!response.ok) {
        const error: ApiErrorResponse = await response.json();
        throw new Error(error.error || "Failed to attach files");
      }

      interface BulkAttachResult {
        updated: number;
        failed: number;
      }
      const result: BulkAttachResult = await response.json();
      
      if (result.failed > 0) {
        toast.warning(
          `Attached files to ${result.updated} application(s). ${result.failed} failed.`
        );
      } else {
        toast.success(
          `Successfully attached files to ${result.updated} application(s)`
        );
      }

      handleCloseAttachDialog();
      
      // Refresh applications if callback provided
      if (onAttachmentsUpdated) {
        onAttachmentsUpdated();
      }
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      toast.error(`Error attaching files: ${errorMessage}`);
    } finally {
      setIsAttaching(false);
    }
  };

  const handleClearAttachments = async () => {
    if (selectedIds.size === 0) {
      toast.error("Please select at least one application");
      return;
    }

    const count = selectedIds.size;
    toast.error(`Clear attachments from ${count} selected application${count > 1 ? 's' : ''}?`, {
      description: "This will remove all attachments from the selected applications.",
      action: {
        label: "Clear",
        onClick: async () => {
          try {
            setIsAttaching(true);
            const response = await fetch("/api/applications/bulk-clear-attachments", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                applicationIds: Array.from(selectedIds),
              }),
            });

            if (!response.ok) {
              const error: ApiErrorResponse = await response.json();
              throw new Error(error.error || "Failed to clear attachments");
            }

            interface BulkClearResult {
              updated: number;
              failed: number;
            }
            const result: BulkClearResult = await response.json();
            
            if (result.failed > 0) {
              toast.warning(
                `Cleared attachments from ${result.updated} application(s). ${result.failed} failed.`
              );
            } else {
              toast.success(
                `Successfully cleared attachments from ${result.updated} application(s)`
              );
            }

            // Refresh applications if callback provided
            if (onAttachmentsUpdated) {
              onAttachmentsUpdated();
            }
          } catch (error: unknown) {
            const errorMessage = getErrorMessage(error);
            toast.error(`Error clearing attachments: ${errorMessage}`);
          } finally {
            setIsAttaching(false);
          }
        },
      },
      cancel: {
        label: "Cancel",
        onClick: () => {},
      },
      duration: 5000,
    });
  };

  const getStatusIcon = (status: Application["status"]) => {
    switch (status) {
      case "sent":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "error":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "sending":
        return <Clock className="h-4 w-4 text-blue-500 animate-spin" />;
      case "cancelled":
        return <Ban className="h-4 w-4 text-gray-500" />;
      default:
        return null;
    }
  };

  if (applications.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-50" />
          <p className="text-muted-foreground font-medium mb-2">No applications added yet</p>
          <p className="text-sm text-muted-foreground">
            Click "Add Application" to get started
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4">
          <div>
            <CardTitle className="text-xl sm:text-2xl">Applications ({applications.length})</CardTitle>
            <CardDescription className="text-sm">
              Select applications and send emails in bulk
            </CardDescription>
          </div>
          {applications.length > 0 && (
            <>
              {/* First row: Selection and action buttons */}
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  onClick={toggleAll}
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-auto"
                >
                  {selectedIds.size === filteredApplications.length && filteredApplications.length > 0 ? (
                    <>
                      <CheckSquare className="h-4 w-4 mr-2" />
                      Deselect All
                    </>
                  ) : (
                    <>
                      <Square className="h-4 w-4 mr-2" />
                      Select All
                    </>
                  )}
                </Button>
                {unsentApplicationIds.length > 0 && (
                  <Button
                    onClick={selectAllUnsent}
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto"
                  >
                    <Square className="h-4 w-4 mr-2" />
                    Select All Unsent ({unsentApplicationIds.length})
                  </Button>
                )}
                {sentApplicationIds.length > 0 && (
                  <Button
                    onClick={selectAllSent}
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto"
                  >
                    <Square className="h-4 w-4 mr-2" />
                    Select All Sent ({sentApplicationIds.length})
                  </Button>
                )}
                {stuckApplicationIds.length > 0 && (
                  <Button
                    onClick={handleCancelStuck}
                    disabled={isCancellingStuck || isQueueProcessing}
                    size="sm"
                    variant="outline"
                    className="w-full sm:w-auto border-orange-500 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/20"
                  >
                    {isCancellingStuck ? (
                      <>
                        <Clock className="h-4 w-4 mr-2 animate-spin" />
                        Cancelling...
                      </>
                    ) : (
                      <>
                        <Ban className="h-4 w-4 mr-2" />
                        Cancel Stuck ({stuckApplicationIds.length})
                      </>
                    )}
                  </Button>
                )}
                {selectedIds.size > 0 && (
                  <Button
                    onClick={handleBulkDelete}
                    disabled={isBulkSending || isQueueProcessing}
                    size="sm"
                    variant="destructive"
                    className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Selected ({selectedIds.size})
                  </Button>
                )}
              </div>
              
              {/* Second row: Send buttons */}
              <div className="flex flex-col sm:flex-row gap-2">
                {selectedIds.size > 0 && (
                  <Button
                    onClick={handleBulkSend}
                    disabled={isBulkSending || isQueueProcessing}
                    size="sm"
                    className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white"
                  >
                    {isBulkSending || isQueueProcessing ? (
                      <>
                        <Clock className="h-4 w-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Send Selected ({selectedIds.size})
                      </>
                    )}
                  </Button>
                )}
                {unsentApplicationIds.length > 0 && (
                  <Button
                    onClick={handleSendAllUnsent}
                    disabled={isBulkSending || isQueueProcessing}
                    size="sm"
                    className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {isBulkSending || isQueueProcessing ? (
                      <>
                        <Clock className="h-4 w-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Send All Unsent ({unsentApplicationIds.length})
                      </>
                    )}
                  </Button>
                )}
              </div>

              {/* Third row: Attachment management buttons */}
              {selectedIds.size > 0 && (
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    onClick={handleOpenAttachDialog}
                    disabled={isBulkSending || isQueueProcessing || isAttaching}
                    size="sm"
                    variant="outline"
                    className="w-full sm:w-auto"
                  >
                    <Paperclip className="h-4 w-4 mr-2" />
                    Attach Files ({selectedIds.size})
                  </Button>
                  <Button
                    onClick={handleClearAttachments}
                    disabled={isBulkSending || isQueueProcessing || isAttaching}
                    size="sm"
                    variant="outline"
                    className="w-full sm:w-auto"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Clear Attachments ({selectedIds.size})
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
        <StatusFilter
          statusFilter={statusFilter}
          onToggleStatus={toggleStatusFilter}
          onSelectAll={selectAllStatuses}
          filteredCount={filteredApplications.length}
          totalCount={applications.length}
        />
      </CardHeader>
      <CardContent>
        {/* Desktop Table View */}
        <div className="hidden md:block rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedIds.size === filteredApplications.length && filteredApplications.length > 0}
                    onCheckedChange={toggleAll}
                  />
                </TableHead>
                <TableHead className="min-w-[120px]">Recipient Name</TableHead>
                <TableHead className="min-w-[150px]">University</TableHead>
                <TableHead className="min-w-[150px]">Email</TableHead>
                <TableHead className="min-w-[150px]">Attachments</TableHead>
                <TableHead className="min-w-[100px]">Status</TableHead>
                <TableHead className="text-right min-w-[140px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredApplications.map((application) => (
                <TableRow 
                  key={application.id}
                  className={cn(
                    application.status === "sent" && "bg-purple-50/30 dark:bg-purple-950/10 border-l-2 border-l-purple-400"
                  )}
                >
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(application.id)}
                      onCheckedChange={() => toggleSelection(application.id)}
                      disabled={application.status === "sending"}
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    {application.name}
                  </TableCell>
                  <TableCell>{application.university}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {application.email}
                  </TableCell>
                  <TableCell>
                    {application.attachments && application.attachments.length > 0 ? (
                      <div className="flex flex-col gap-0.5">
                        {application.attachments.map((att, idx) => (
                          <AttachmentPreview
                            key={idx}
                            id={att.id}
                            filename={att.filename}
                            content={att.content}
                            contentType={att.contentType}
                          >
                            <div className="text-xs text-muted-foreground flex items-center gap-1.5 hover:text-foreground transition-colors" title={att.filename}>
                              <Paperclip className="h-3 w-3 flex-shrink-0" />
                              <span className="truncate">{att.filename}</span>
                            </div>
                          </AttachmentPreview>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(application.status)}
                      <span className="text-sm capitalize">{application.status}</span>
                    </div>
                    {application.error && (
                      <div className="text-xs text-red-500 mt-1 break-words max-w-[200px]" title={application.error}>
                        {application.error.length > 100 ? `${application.error.substring(0, 100)}...` : application.error}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {application.status === "pending" && (
                        <Button
                          onClick={() => onSendEmail(application)}
                          size="sm"
                          variant="outline"
                          title="Send email"
                          className="h-8 w-8 p-0 border-green-300 text-green-700 hover:bg-green-50 dark:border-green-700 dark:text-green-400 dark:hover:bg-green-950/30"
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                      )}
                      {application.status === "error" && (
                        <Button
                          onClick={() => onSendEmail(application)}
                          size="sm"
                          variant="outline"
                          title="Retry sending email"
                          className="h-8 w-8 p-0 border-orange-300 text-orange-700 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-400 dark:hover:bg-orange-950/30"
                        >
                          <RotateCw className="h-4 w-4" />
                        </Button>
                      )}
                      {application.status === "sent" && (
                        <Button
                          onClick={() => onSendEmail(application)}
                          size="sm"
                          variant="outline"
                          title="Resend email"
                          className="h-8 w-8 p-0 border-purple-300 text-purple-700 hover:bg-purple-50 dark:border-purple-700 dark:text-purple-400 dark:hover:bg-purple-950/30"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        onClick={() => router.push(`/applications/${application.id}`)}
                        size="sm"
                        variant="outline"
                        title="View application"
                        className="h-8 w-8 p-0 border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-950/30"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        onClick={() => router.push(`/applications/${application.id}/edit`)}
                        size="sm"
                        variant="outline"
                        title="Edit application"
                        className="h-8 w-8 p-0 border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-400 dark:hover:bg-blue-950/30"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        onClick={() => {
                          toast.error(`Delete ${application.name}?`, {
                            description: "This action cannot be undone.",
                            action: {
                              label: "Delete",
                              onClick: () => onRemove(application.id),
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
                        title="Remove application"
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
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

        {/* Mobile Card View */}
        <div className="md:hidden space-y-3">
          {/* Select All for Mobile */}
          {filteredApplications.length > 0 && (
            <div className="flex items-center gap-2 pb-2 border-b">
              <Checkbox
                checked={selectedIds.size === filteredApplications.length && filteredApplications.length > 0}
                onCheckedChange={toggleAll}
              />
              <label className="text-sm font-medium cursor-pointer" onClick={toggleAll}>
                Select All ({filteredApplications.length})
              </label>
            </div>
          )}
          {filteredApplications.map((application) => (
            <Card 
              key={application.id} 
              className={cn(
                "border overflow-hidden",
                application.status === "sent" && "bg-purple-50/30 dark:bg-purple-950/10 border-l-4 border-l-purple-400"
              )}
            >
              <CardContent className="p-3 sm:p-4 space-y-3">
                {/* Header with checkbox and name */}
                <div className="flex items-start gap-2 sm:gap-3">
                  <Checkbox
                    checked={selectedIds.has(application.id)}
                    onCheckedChange={() => toggleSelection(application.id)}
                    disabled={application.status === "sending"}
                    className="mt-1 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm sm:text-base truncate">{application.name}</h3>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-1 break-words">{application.university}</p>
                    <p className="text-xs text-muted-foreground mt-1 break-all">{application.email}</p>
                  </div>
                </div>

                {/* Attachments Row */}
                {application.attachments && application.attachments.length > 0 && (
                  <div className="flex flex-col gap-1 pt-1 border-t">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Paperclip className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      <span className="text-xs font-medium text-muted-foreground">
                        Attachments ({application.attachments.length}):
                      </span>
                    </div>
                    <div className="flex flex-col gap-0.5 pl-5">
                      {application.attachments.map((att, idx) => (
                        <AttachmentPreview
                          key={idx}
                          id={att.id}
                          filename={att.filename}
                          content={att.content}
                          contentType={att.contentType}
                        >
                          <div className="text-xs text-muted-foreground truncate hover:text-foreground transition-colors cursor-pointer" title={att.filename}>
                            • {att.filename}
                          </div>
                        </AttachmentPreview>
                      ))}
                    </div>
                  </div>
                )}

                {/* Status */}
                <div className="flex items-center gap-2">
                  {getStatusIcon(application.status)}
                  <span className="text-xs sm:text-sm capitalize font-medium">{application.status}</span>
                </div>
                {application.error && (
                  <div className="text-xs text-red-500 bg-red-50 dark:bg-red-950/30 p-2 rounded break-words" title={application.error}>
                    {application.error.length > 150 ? `${application.error.substring(0, 150)}...` : application.error}
                  </div>
                )}

                {/* Actions - Always visible on mobile */}
                <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-1.5 sm:gap-2 pt-2 border-t">
                  {application.status === "pending" && (
                    <Button
                      onClick={() => onSendEmail(application)}
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 text-white text-xs"
                    >
                      <Send className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                      Send
                    </Button>
                  )}
                  {application.status === "error" && (
                    <Button
                      onClick={() => onSendEmail(application)}
                      size="sm"
                      className="bg-orange-600 hover:bg-orange-700 text-white text-xs"
                    >
                      <RotateCw className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                      Retry
                    </Button>
                  )}
                  {application.status === "sent" && (
                    <Button
                      onClick={() => onSendEmail(application)}
                      size="sm"
                      className="bg-purple-600 hover:bg-purple-700 text-white text-xs"
                    >
                      <RefreshCw className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                      Resend
                    </Button>
                  )}
                  <Button
                    onClick={() => router.push(`/applications/${application.id}`)}
                    size="sm"
                    variant="outline"
                    className="border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-950/30 text-xs"
                  >
                    <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                    View
                  </Button>
                  <Button
                    onClick={() => router.push(`/applications/${application.id}/edit`)}
                    size="sm"
                    variant="outline"
                    className="border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-400 dark:hover:bg-blue-950/30 text-xs"
                  >
                    <Pencil className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                    Edit
                  </Button>
                  <Button
                    onClick={() => {
                      toast.error(`Delete ${application.name}?`, {
                        description: "This action cannot be undone.",
                        action: {
                          label: "Delete",
                          onClick: () => onRemove(application.id),
                        },
                        cancel: {
                          label: "Cancel",
                          onClick: () => {},
                        },
                        duration: 5000,
                      });
                    }}
                    size="sm"
                    variant="destructive"
                    className="bg-red-600 hover:bg-red-700 text-white text-xs"
                  >
                    <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>

      {/* Attach Files Dialog */}
      <Dialog open={isAttachDialogOpen} onOpenChange={setIsAttachDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Attach Files to Selected Applications</DialogTitle>
            <DialogDescription>
              Select one or more attachments to add to {selectedIds.size} selected application(s)
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {isLoadingAttachments ? (
              <div className="flex items-center justify-center py-8">
                <Clock className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Loading attachments...</span>
              </div>
            ) : availableAttachments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <File className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No attachments available</p>
                <p className="text-sm mt-2">Upload attachments from the Attachments page</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {availableAttachments.map((attachment) => (
                  <div
                    key={attachment._id}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-md border cursor-pointer transition-colors",
                      selectedAttachmentIds.has(attachment._id)
                        ? "bg-primary/10 border-primary"
                        : "hover:bg-accent"
                    )}
                    onClick={() => toggleAttachmentSelection(attachment._id)}
                  >
                    <Checkbox
                      checked={selectedAttachmentIds.has(attachment._id)}
                      onCheckedChange={() => toggleAttachmentSelection(attachment._id)}
                    />
                    <File className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{attachment.filename}</p>
                      {attachment.contentType && (
                        <p className="text-xs text-muted-foreground">{attachment.contentType}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleCloseAttachDialog}
              disabled={isAttaching}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAttachToSelected}
              disabled={isAttaching || selectedAttachmentIds.size === 0}
            >
              {isAttaching ? (
                <>
                  <Clock className="h-4 w-4 mr-2 animate-spin" />
                  Attaching...
                </>
              ) : (
                <>
                  <Paperclip className="h-4 w-4 mr-2" />
                  Attach {selectedAttachmentIds.size > 0 ? `(${selectedAttachmentIds.size})` : ""}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

