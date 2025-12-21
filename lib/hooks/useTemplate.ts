import { useState, useEffect } from "react";
import { Attachment } from "@/lib/utils/attachments";
import { DEFAULT_EMAIL_TEMPLATE } from "@/lib/constants/emailTemplate";

export interface TemplateData {
  content: string;
  description?: string;
  subject?: string;
  attachments: Attachment[];
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
          
          // Convert template attachments to Attachment format
          const attachments: Attachment[] = (data.attachments || []).map((att: any) => ({
            filename: att.filename,
            content: att.content,
            contentType: att.contentType,
          }));

          setTemplateData({
            content: data.content || DEFAULT_EMAIL_TEMPLATE,
            description: data.description,
            subject: data.subject,
            attachments,
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
        
        const attachments: Attachment[] = (data.attachments || []).map((att: any) => ({
          filename: att.filename,
          content: att.content,
          contentType: att.contentType,
        }));

        setTemplateData({
          content: data.content || DEFAULT_EMAIL_TEMPLATE,
          description: data.description,
          subject: data.subject,
          attachments,
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

