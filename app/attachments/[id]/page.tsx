"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Download, FileText, Image as ImageIcon, Calendar, HardDrive, File } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatFileSize } from "@/lib/utils/attachments";

interface Attachment {
  _id: string;
  filename: string;
  content: string;
  contentType?: string;
  size?: number;
  createdAt?: string;
  updatedAt?: string;
}

export default function ViewAttachmentPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [isLoading, setIsLoading] = useState(true);
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    const loadAttachment = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/attachments/${id}`);
        if (!response.ok) {
          throw new Error("Failed to load attachment");
        }
        const data = await response.json();
        setAttachment(data);
        
        // Create data URL for preview
        if (data.content) {
          const isPDF = data.contentType === "application/pdf" || data.filename.toLowerCase().endsWith(".pdf");
          const isImage = data.contentType?.startsWith("image/") || 
            /\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i.test(data.filename);
          
          if (isPDF || isImage) {
            const dataUrl = isPDF 
              ? `data:application/pdf;base64,${data.content}`
              : `data:${data.contentType || 'image/png'};base64,${data.content}`;
            setPreviewUrl(dataUrl);
          }
        }
      } catch (error: any) {
        toast.error(`Error loading attachment: ${error.message}`);
        router.push("/");
      } finally {
        setIsLoading(false);
      }
    };

    if (id) {
      loadAttachment();
    }
  }, [id, router]);

  const handleDownload = () => {
    if (!attachment) return;
    
    try {
      const byteCharacters = atob(attachment.content);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: attachment.contentType || "application/octet-stream" });
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = attachment.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading file:", error);
      toast.error("Failed to download file. Please try again.");
    }
  };

  const isPDF = attachment?.contentType === "application/pdf" || attachment?.filename.toLowerCase().endsWith(".pdf");
  const isImage = attachment?.contentType?.startsWith("image/") || 
    (attachment?.filename && /\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i.test(attachment.filename));

  if (isLoading) {
    return (
      <main className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-[60vh]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading attachment...</p>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!attachment) {
    return (
      <main className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-[60vh]">
            <div className="text-center">
              <p className="text-lg font-medium mb-2">Attachment not found</p>
              <Button onClick={() => router.push("/")} variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Go Back
              </Button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.back()}
              className="flex-shrink-0"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl font-bold truncate">{attachment.filename}</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Attachment Details
              </p>
            </div>
          </div>
          <Button
            onClick={handleDownload}
            className="bg-primary hover:bg-primary/90 flex-shrink-0"
          >
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Preview Section - Takes 2 columns on large screens */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {isPDF ? (
                    <FileText className="h-5 w-5 text-primary" />
                  ) : isImage ? (
                    <ImageIcon className="h-5 w-5 text-primary" />
                  ) : (
                    <File className="h-5 w-5 text-primary" />
                  )}
                  Preview
                </CardTitle>
              </CardHeader>
              <CardContent>
                {previewUrl ? (
                  <div className="w-full h-[calc(100vh-300px)] min-h-[500px] flex items-center justify-center bg-muted/50 rounded border">
                    {isPDF ? (
                      <iframe
                        src={previewUrl}
                        className="w-full h-full border-0 rounded"
                        title={attachment.filename}
                      />
                    ) : (
                      <img
                        src={previewUrl}
                        alt={attachment.filename}
                        className="max-w-full max-h-full object-contain"
                      />
                    )}
                  </div>
                ) : (
                  <div className="w-full h-[calc(100vh-300px)] min-h-[500px] flex flex-col items-center justify-center bg-muted/50 rounded border p-8 text-center">
                    <File className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground mb-2">Preview not available</p>
                    <p className="text-sm text-muted-foreground">
                      This file type cannot be previewed in the browser.
                    </p>
                    <Button
                      onClick={handleDownload}
                      className="mt-4 bg-primary hover:bg-primary/90"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download to View
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Details Section - Takes 1 column on large screens */}
          <div className="space-y-4 sm:space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>File Information</CardTitle>
                <CardDescription>
                  Details about this attachment
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Filename
                  </label>
                  <p className="text-sm mt-1 break-all">{attachment.filename}</p>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    File Type
                  </label>
                  <div className="mt-1">
                    {attachment.contentType ? (
                      <Badge variant="outline">{attachment.contentType}</Badge>
                    ) : (
                      <span className="text-sm text-muted-foreground">Unknown</span>
                    )}
                  </div>
                </div>

                {attachment.size && (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                      <HardDrive className="h-3 w-3" />
                      File Size
                    </label>
                    <p className="text-sm mt-1">{formatFileSize(attachment.size)}</p>
                  </div>
                )}

                {attachment.createdAt && (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Created
                    </label>
                    <p className="text-sm mt-1">
                      {new Date(attachment.createdAt).toLocaleString()}
                    </p>
                  </div>
                )}

                {attachment.updatedAt && attachment.updatedAt !== attachment.createdAt && (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Last Modified
                    </label>
                    <p className="text-sm mt-1">
                      {new Date(attachment.updatedAt).toLocaleString()}
                    </p>
                  </div>
                )}

                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Attachment ID
                  </label>
                  <p className="text-sm mt-1 font-mono text-xs break-all">{attachment._id}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}

