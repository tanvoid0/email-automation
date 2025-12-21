"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, FileText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface AttachmentPreviewProps {
  id?: string; // Attachment ID from database
  filename: string;
  content: string;
  contentType?: string;
  children: React.ReactNode;
}

export function AttachmentPreview({
  id,
  filename,
  content,
  contentType,
  children,
}: AttachmentPreviewProps) {
  const router = useRouter();
  const [showDownloadPrompt, setShowDownloadPrompt] = useState(false);

  const isPDF = contentType === "application/pdf" || filename.toLowerCase().endsWith(".pdf");
  const isImage = contentType?.startsWith("image/") || 
    /\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i.test(filename);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // If we have an ID, navigate to the dedicated attachment page
    if (id) {
      router.push(`/attachments/${id}`);
    } else if (isPDF || isImage) {
      // Fallback: For attachments without ID, show download prompt
      // This shouldn't happen in normal flow, but keeping for backwards compatibility
      setShowDownloadPrompt(true);
    } else {
      setShowDownloadPrompt(true);
    }
  };

  const handleDownload = () => {
    try {
      // Convert base64 content to blob
      const byteCharacters = atob(content);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: contentType || "application/octet-stream" });
      
      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      setShowDownloadPrompt(false);
    } catch (error) {
      console.error("Error downloading file:", error);
      alert("Failed to download file. Please try again.");
    }
  };

  const handlePreview = () => {
    try {
      // Convert base64 content to blob
      const byteCharacters = atob(content);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: contentType || "application/octet-stream" });
      
      // Open in new tab
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      URL.revokeObjectURL(url);
      
      setShowDownloadPrompt(false);
    } catch (error) {
      console.error("Error previewing file:", error);
      alert("Failed to preview file. Please try again.");
    }
  };

  return (
    <>
      <div onClick={handleClick} className="cursor-pointer hover:underline">
        {children}
      </div>

      {/* Download/Preview Prompt for files without ID */}
      {!id && (
        <Dialog open={showDownloadPrompt} onOpenChange={setShowDownloadPrompt}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>File: {filename}</DialogTitle>
              <DialogDescription>
                {isPDF || isImage
                  ? "Would you like to download this file or open it in a new tab?"
                  : "This file cannot be previewed in the browser. Would you like to download it or open it in a new tab?"}
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowDownloadPrompt(false)}
              >
                Cancel
              </Button>
              <Button
                variant="outline"
                onClick={handlePreview}
              >
                <FileText className="h-4 w-4 mr-2" />
                Open in New Tab
              </Button>
              <Button
                onClick={handleDownload}
                className="bg-primary hover:bg-primary/90"
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

