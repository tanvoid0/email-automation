"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { X, Paperclip, Trash2 } from "lucide-react";
import { Attachment, fileToAttachment, formatFileSize } from "@/lib/utils/attachments";
import { AttachmentPreview } from "./AttachmentPreview";

interface FileAttachmentsProps {
  attachments: Attachment[];
  onAttachmentsChange: (attachments: Attachment[]) => void;
  maxSize?: number; // in bytes, default 10MB
  maxFiles?: number; // default 10
}

export function FileAttachments({
  attachments,
  onAttachmentsChange,
  maxSize = 10 * 1024 * 1024, // 10MB default
  maxFiles = 10,
}: FileAttachmentsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    if (attachments.length + files.length > maxFiles) {
      alert(`Maximum ${maxFiles} files allowed. You already have ${attachments.length} file(s).`);
      return;
    }

    setIsUploading(true);
    try {
      const newAttachments: Attachment[] = [];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Check file size
        if (file.size > maxSize) {
          alert(`File "${file.name}" is too large. Maximum size is ${formatFileSize(maxSize)}.`);
          continue;
        }

        // Check if file already exists
        if (attachments.some(a => a.filename === file.name)) {
          alert(`File "${file.name}" is already attached.`);
          continue;
        }

        const attachment = await fileToAttachment(file);
        newAttachments.push(attachment);
      }

      if (newAttachments.length > 0) {
        onAttachmentsChange([...attachments, ...newAttachments]);
      }
    } catch (error: any) {
      console.error("Error processing files:", error);
      alert(`Error processing files: ${error.message}`);
    } finally {
      setIsUploading(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemove = (index: number) => {
    const newAttachments = attachments.filter((_, i) => i !== index);
    onAttachmentsChange(newAttachments);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading || attachments.length >= maxFiles}
        >
          <Paperclip className="h-4 w-4 mr-2" />
          {isUploading ? "Uploading..." : "Add Files"}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          accept="*/*"
        />
        <span className="text-xs text-muted-foreground">
          {attachments.length}/{maxFiles} files (Max {formatFileSize(maxSize)} each)
        </span>
      </div>
      
      {attachments.length > 0 && (
        <div className="space-y-2 border rounded-md p-3 bg-muted/50">
          <div className="text-sm font-medium">Attached Files:</div>
          <div className="space-y-1">
            {attachments.map((attachment, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-2 bg-background rounded border"
              >
                <AttachmentPreview
                  filename={attachment.filename}
                  content={attachment.content}
                  contentType={attachment.contentType}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer hover:text-foreground transition-colors">
                    <Paperclip className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm truncate" title={attachment.filename}>
                      {attachment.filename}
                    </span>
                    {attachment.contentType && (
                      <span className="text-xs text-muted-foreground">
                        ({attachment.contentType.split('/')[1] || 'file'})
                      </span>
                    )}
                  </div>
                </AttachmentPreview>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemove(index);
                  }}
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
  );
}

