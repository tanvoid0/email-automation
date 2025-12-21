export interface Attachment {
  filename: string;
  content: string; // base64 encoded
  contentType?: string;
}

/**
 * Convert a File to base64 encoded attachment
 */
export async function fileToAttachment(file: File): Promise<Attachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix (e.g., "data:image/png;base64,")
      const base64Content = result.split(',')[1] || result;
      resolve({
        filename: file.name,
        content: base64Content,
        contentType: file.type || undefined,
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Convert base64 attachment back to File-like object for download
 */
export function attachmentToDataUrl(attachment: Attachment): string {
  const contentType = attachment.contentType || 'application/octet-stream';
  return `data:${contentType};base64,${attachment.content}`;
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

