"use client";

import { useState, useEffect, useRef } from "react";

export const dynamic = 'force-dynamic';
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useToast } from "@/lib/hooks/useToast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  ArrowLeft, 
  File, 
  ExternalLink, 
  Trash2, 
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Plus,
  Upload,
  Clock
} from "lucide-react";
import { formatFileSize, fileToAttachment } from "@/lib/utils/attachments";

interface AttachmentWithReferences {
  _id: string;
  filename: string;
  contentType?: string;
  size?: number;
  createdAt?: string;
  updatedAt?: string;
  linkedApplications: Array<{
    id: string;
    name: string;
    email: string;
  }>;
  isInTemplate: boolean;
  referenceCount: number;
}

export default function AttachmentsPage() {
  const toast = useToast();
  const router = useRouter();
  const [attachments, setAttachments] = useState<AttachmentWithReferences[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadAttachments();
  }, []);

  const loadAttachments = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/attachments/with-references");
      if (!response.ok) {
        throw new Error("Failed to load attachments");
      }
      const data = await response.json();
      setAttachments(data);
    } catch (error: any) {
      toast.error(`Error loading attachments: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCleanup = async () => {
    try {
      setIsCleaningUp(true);
      const response = await fetch("/api/attachments/cleanup", {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error("Failed to cleanup attachments");
      }
      const result = await response.json();
      toast.success(`Cleaned up ${result.deletedCount} dangling attachment(s)`);
      await loadAttachments();
    } catch (error: any) {
      toast.error(`Error cleaning up: ${error.message}`);
    } finally {
      setIsCleaningUp(false);
    }
  };

  const handleDelete = async (attachmentId: string) => {
    if (!confirm("Are you sure you want to delete this attachment?")) {
      return;
    }

    try {
      const response = await fetch(`/api/attachments/${attachmentId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Failed to delete attachment");
      }
      toast.success("Attachment deleted successfully");
      await loadAttachments();
    } catch (error: any) {
      toast.error(`Error deleting attachment: ${error.message}`);
    }
  };

  const danglingCount = attachments.filter(att => att.referenceCount === 0).length;

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    setSelectedFiles(Array.from(files));
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleOpenAddDialog = () => {
    setSelectedFiles([]);
    setIsAddDialogOpen(true);
  };

  const handleCloseAddDialog = () => {
    setIsAddDialogOpen(false);
    setSelectedFiles([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUploadAttachments = async () => {
    if (selectedFiles.length === 0) {
      toast.error("Please select at least one file");
      return;
    }

    setIsUploading(true);
    try {
      const uploadPromises = selectedFiles.map(async (file) => {
        // Convert file to attachment format
        const attachment = await fileToAttachment(file);
        
        // Upload to API
        const response = await fetch("/api/attachments", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(attachment),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || `Failed to upload ${file.name}`);
        }

        return await response.json();
      });

      await Promise.all(uploadPromises);
      
      toast.success(`Successfully uploaded ${selectedFiles.length} attachment(s)`);
      handleCloseAddDialog();
      await loadAttachments();
    } catch (error: any) {
      toast.error(`Error uploading attachments: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  if (isLoading) {
    return (
      <main className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-[60vh]">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
              <p className="text-muted-foreground">Loading attachments...</p>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.back()}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">Attachments</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Manage all file attachments and their references
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleOpenAddDialog}
              className="bg-primary hover:bg-primary/90"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Attachment
            </Button>
            <Button
              variant="outline"
              onClick={handleCleanup}
              disabled={isCleaningUp || danglingCount === 0}
            >
              {isCleaningUp ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Cleaning...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Cleanup Dangling ({danglingCount})
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={loadAttachments}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Total Attachments</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{attachments.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Linked Attachments</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {attachments.filter(att => att.referenceCount > 0).length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Dangling Attachments</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{danglingCount}</div>
            </CardContent>
          </Card>
        </div>

        {/* Attachments Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Attachments</CardTitle>
            <CardDescription>
              View all attachments and their links to applications and templates
            </CardDescription>
          </CardHeader>
          <CardContent>
            {attachments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <File className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No attachments found</p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Filename</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>References</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attachments.map((attachment) => (
                      <TableRow key={attachment._id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <File className="h-4 w-4 text-muted-foreground" />
                            <span className="truncate max-w-[200px]" title={attachment.filename}>
                              {attachment.filename}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {attachment.contentType ? (
                            <Badge variant="outline">{attachment.contentType}</Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">Unknown</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {attachment.size ? (
                            <span className="text-sm">{formatFileSize(attachment.size)}</span>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {attachment.referenceCount === 0 ? (
                            <Badge variant="destructive" className="gap-1">
                              <AlertCircle className="h-3 w-3" />
                              Dangling
                            </Badge>
                          ) : (
                            <Badge variant="default" className="gap-1 bg-green-600">
                              <CheckCircle2 className="h-3 w-3" />
                              Linked
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1.5 min-w-[200px]">
                            {attachment.isInTemplate && (
                              <div>
                                <Badge variant="secondary" className="mb-1">
                                  Template
                                </Badge>
                              </div>
                            )}
                            {attachment.linkedApplications.length > 0 && (
                              <div className="space-y-1">
                                <div className="text-xs font-medium text-muted-foreground mb-1">
                                  Applications ({attachment.linkedApplications.length}):
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {attachment.linkedApplications.map((app) => (
                                    <Link
                                      key={app.id}
                                      href={`/applications/${app.id}`}
                                      className="inline-flex"
                                    >
                                      <Badge
                                        variant="outline"
                                        className="cursor-pointer hover:bg-accent text-xs"
                                      >
                                        {app.name}
                                        <ExternalLink className="h-3 w-3 ml-1" />
                                      </Badge>
                                    </Link>
                                  ))}
                                </div>
                              </div>
                            )}
                            {attachment.referenceCount === 0 && (
                              <span className="text-xs text-muted-foreground">No references</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {attachment.createdAt ? (
                            <span className="text-sm text-muted-foreground">
                              {new Date(attachment.createdAt).toLocaleDateString()}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => router.push(`/attachments/${attachment._id}`)}
                            >
                              View
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(attachment._id)}
                              className="text-destructive hover:text-destructive"
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
            )}
          </CardContent>
        </Card>

        {/* Add Attachment Dialog */}
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add Attachment</DialogTitle>
              <DialogDescription>
                Select one or more files to upload as attachments
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="w-full"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {isUploading ? "Uploading..." : "Choose Files"}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                  accept="*/*"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Maximum file size: 10MB per file
                </p>
              </div>

              {selectedFiles.length > 0 && (
                <div className="space-y-2 border rounded-md p-3 bg-muted/50 max-h-[300px] overflow-y-auto">
                  <div className="text-sm font-medium">Selected Files ({selectedFiles.length}):</div>
                  <div className="space-y-1">
                    {selectedFiles.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-2 bg-background rounded border"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <File className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm truncate" title={file.name}>
                              {file.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatFileSize(file.size)}
                              {file.type && ` • ${file.type}`}
                            </p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveFile(index)}
                          disabled={isUploading}
                          className="flex-shrink-0"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={handleCloseAddDialog}
                disabled={isUploading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleUploadAttachments}
                disabled={isUploading || selectedFiles.length === 0}
              >
                {isUploading ? (
                  <>
                    <Clock className="h-4 w-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload {selectedFiles.length > 0 ? `(${selectedFiles.length})` : ""}
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </main>
  );
}

