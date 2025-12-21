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
import { Send, CheckCircle2, XCircle, Clock, Pencil, Trash2, RotateCw, Paperclip, CheckSquare, Square, Mail, Eye } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { StatusFilter } from "./StatusFilter";
import { AttachmentPreview } from "./AttachmentPreview";
import { cn } from "@/lib/utils";

export interface Application {
  id: string;
  name: string;
  university: string;
  email: string;
  emailText: string;
  status: "pending" | "sending" | "sent" | "error";
  error?: string;
  attachments?: Array<{
    id?: string;
    filename: string;
    content: string;
    contentType?: string;
  }>;
  attachmentIds?: string[]; // Array of attachment IDs for API calls
}

interface ApplicationListProps {
  applications: Application[];
  onSendEmail: (application: Application) => Promise<void>;
  onBulkSend: (applicationIds: string[]) => Promise<void>;
  onRemove: (id: string) => void;
  bulkSendProgress: {
    total: number;
    sent: number;
    inProgress: boolean;
  } | null;
}

export function ApplicationList({
  applications,
  onSendEmail,
  onBulkSend,
  onRemove,
  bulkSendProgress,
}: ApplicationListProps) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkSending, setIsBulkSending] = useState(false);
  const [statusFilter, setStatusFilter] = useState<Set<Application["status"]>>(
    new Set(["pending", "sending", "sent", "error"])
  );

  // Filter applications based on status filter
  const filteredApplications = applications.filter((p) => statusFilter.has(p.status));

  // Get all unsent application IDs
  const unsentApplicationIds = applications
    .filter((p) => p.status === "pending")
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
    setStatusFilter(new Set(["pending", "sending", "sent", "error"]));
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

  const handleSendAllUnsent = async () => {
    if (unsentApplicationIds.length === 0) {
      toast.error("No unsent emails to send");
      return;
    }

    if (bulkSendProgress?.inProgress) {
      toast.error("Bulk send already in progress");
      return;
    }

    setIsBulkSending(true);
    try {
      await onBulkSend(unsentApplicationIds);
    } catch (error: any) {
      toast.error(`Error sending emails: ${error.message}`);
    } finally {
      setIsBulkSending(false);
    }
  };

  const handleBulkSend = async () => {
    if (selectedIds.size === 0) {
      toast.error("Please select at least one application");
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

  const getStatusIcon = (status: Application["status"]) => {
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
              <Button
                onClick={handleBulkSend}
                disabled={isBulkSending || selectedIds.size === 0 || (bulkSendProgress?.inProgress ?? false)}
                size="sm"
                className={cn(
                  "w-full sm:w-auto",
                  selectedIds.size > 0 && "bg-green-600 hover:bg-green-700 text-white"
                )}
              >
                {isBulkSending || (bulkSendProgress?.inProgress ?? false) ? (
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
              {unsentApplicationIds.length > 0 && (
                <Button
                  onClick={handleSendAllUnsent}
                  disabled={isBulkSending || (bulkSendProgress?.inProgress ?? false)}
                  size="sm"
                  className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {isBulkSending || (bulkSendProgress?.inProgress ?? false) ? (
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
                <TableRow key={application.id}>
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
                      <div className="text-xs text-red-500 mt-1 break-words max-w-[200px]">
                        {application.error}
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
            <Card key={application.id} className="border overflow-hidden">
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
                  <div className="text-xs text-red-500 bg-red-50 dark:bg-red-950/30 p-2 rounded break-words">
                    {application.error}
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
    </Card>
  );
}

