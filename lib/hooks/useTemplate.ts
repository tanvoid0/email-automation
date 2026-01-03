import { useState, useEffect } from "react";
import { Attachment } from "@/lib/utils/attachments";
import { DEFAULT_EMAIL_TEMPLATE } from "@/lib/constants/emailTemplate";

export interface TemplateData {
  content: string;
  description?: string;
  subject?: string;
  attachments: Attachment[]; // For display purposes
  attachmentIds?: string[]; // The actual IDs to use when creating applications
}

export function useTemplate() {
  const [templateData, setTemplateData] = useState<TemplateData>({
    content: DEFAULT_EMAIL_TEMPLATE,
    attachments: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadTemplate = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await fetch("/api/template");
        if (response.ok) {
          const data = await response.json();
          
          // Template attachments are now IDs, not objects
          // We need to fetch the actual attachment data for display, but keep track of IDs
          const attachmentIds = data.attachments || [];
          let attachments: Attachment[] = [];
          
          // If we have attachment IDs, fetch the attachment details for display
          if (attachmentIds.length > 0 && typeof attachmentIds[0] === 'string') {
            try {
              const attachmentsResponse = await fetch("/api/attachments/batch", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids: attachmentIds }),
              });
              if (attachmentsResponse.ok) {
                const fetchedAttachments = await attachmentsResponse.json();
                attachments = fetchedAttachments.map((att: any) => ({
                  filename: att.filename,
                  content: att.content,
                  contentType: att.contentType,
                }));
              }
            } catch (error) {
              console.warn("Failed to fetch template attachment details:", error);
            }
          } else if (attachmentIds.length > 0 && typeof attachmentIds[0] === 'object') {
            // Legacy format: embedded objects (for backward compatibility)
            attachments = attachmentIds.map((att: any) => ({
              filename: att.filename,
              content: att.content,
              contentType: att.contentType,
            }));
          }

          setTemplateData({
            content: data.content || DEFAULT_EMAIL_TEMPLATE,
            description: data.description,
            subject: data.subject,
            attachments,
            attachmentIds: typeof attachmentIds[0] === 'string' ? attachmentIds : undefined,
          });
        } else {
          console.warn("Failed to load template from DB, using fallback");
          setTemplateData({
            content: DEFAULT_EMAIL_TEMPLATE,
            attachments: [],
          });
        }
      } catch (error: any) {
        console.error("Error loading template:", error);
        setError(error.message);
        setTemplateData({
          content: DEFAULT_EMAIL_TEMPLATE,
          attachments: [],
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadTemplate();
  }, []);

  const reloadTemplate = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch("/api/template");
      if (response.ok) {
        const data = await response.json();
        
        // Template attachments are now IDs, not objects
        const attachmentIds = data.attachments || [];
        let attachments: Attachment[] = [];
        
        // If we have attachment IDs, fetch the actual attachment data for display
        if (attachmentIds.length > 0 && typeof attachmentIds[0] === 'string') {
          try {
            const attachmentsResponse = await fetch("/api/attachments/batch", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ids: attachmentIds }),
            });
            if (attachmentsResponse.ok) {
              const fetchedAttachments = await attachmentsResponse.json();
              attachments = fetchedAttachments.map((att: any) => ({
                filename: att.filename,
                content: att.content,
                contentType: att.contentType,
              }));
            }
          } catch (error) {
            console.warn("Failed to fetch template attachment details:", error);
          }
        } else if (attachmentIds.length > 0 && typeof attachmentIds[0] === 'object') {
          // Legacy format: embedded objects
          attachments = attachmentIds.map((att: any) => ({
            filename: att.filename,
            content: att.content,
            contentType: att.contentType,
          }));
        }

        setTemplateData({
          content: data.content || DEFAULT_EMAIL_TEMPLATE,
          description: data.description,
          subject: data.subject,
          attachments,
          attachmentIds: typeof attachmentIds[0] === 'string' ? attachmentIds : undefined,
        });
      }
    } catch (error: any) {
      console.error("Error reloading template:", error);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    templateData,
    isLoading,
    error,
    reloadTemplate,
  };
}

