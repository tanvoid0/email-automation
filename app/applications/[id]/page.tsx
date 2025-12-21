"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Pencil, Mail, User, Building2, Send, CheckCircle2, XCircle, Clock, Paperclip, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AttachmentPreview } from "@/app/components/AttachmentPreview";

interface Application {
  _id: string;
  name: string;
  university: string;
  email: string;
  emailText: string;
  status: string;
  error?: string;
  attachments?: Array<{
    filename: string;
    content: string;
    contentType?: string;
  }>;
}

export default function ViewApplicationPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [isLoading, setIsLoading] = useState(true);
  const [application, setApplication] = useState<Application | null>(null);
  const [attachments, setAttachments] = useState<any[]>([]);

  useEffect(() => {
    const loadApplication = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/applications/${id}`);
        if (!response.ok) {
          throw new Error("Failed to load application");
        }
        const data = await response.json();
        setApplication(data);
        
        // Load attachments if they exist
        if (data.attachments && data.attachments.length > 0) {
          try {
            const attachmentsResponse = await fetch("/api/attachments/batch", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ids: data.attachments }),
            });
            if (attachmentsResponse.ok) {
              const attachmentsData = await attachmentsResponse.json();
              setAttachments(attachmentsData);
            }
          } catch (error) {
            console.warn("Failed to load attachments:", error);
          }
        }
      } catch (error: any) {
        toast.error(`Error loading application: ${error.message}`);
        router.push("/");
      } finally {
        setIsLoading(false);
      }
    };

    if (id) {
      loadApplication();
    }
  }, [id, router]);

  const getStatusIcon = (status: string) => {
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

  const getStatusBadge = (status: string) => {
    const baseClasses = "capitalize font-medium";
    switch (status) {
      case "pending":
        return <Badge variant="outline" className={`${baseClasses} border-yellow-500 text-yellow-700 dark:text-yellow-400`}>Pending</Badge>;
      case "sending":
        return <Badge variant="outline" className={`${baseClasses} border-blue-500 text-blue-700 dark:text-blue-400`}>Sending</Badge>;
      case "sent":
        return <Badge variant="outline" className={`${baseClasses} border-green-500 text-green-700 dark:text-green-400`}>Sent</Badge>;
      case "error":
        return <Badge variant="outline" className={`${baseClasses} border-red-500 text-red-700 dark:text-red-400`}>Error</Badge>;
      default:
        return <Badge variant="outline" className={baseClasses}>{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <main className="min-h-screen bg-background p-4 md:p-8">
        <div className="max-w-4xl mx-auto flex flex-col items-center justify-center h-64 gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground font-medium">Loading application...</p>
        </div>
      </main>
    );
  }

  if (!application) {
    return (
      <main className="min-h-screen bg-background p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground mb-4">Application not found</p>
              <Link href="/">
                <Button variant="outline">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Home
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-4 md:space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 flex-1 min-w-0">
            <Link href="/" className="w-full sm:w-auto">
              <Button variant="outline" size="sm" className="w-full sm:w-auto">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold">Application Details</h1>
              <p className="text-sm sm:text-base text-muted-foreground">
                Review application information and email template
              </p>
            </div>
          </div>
          <Link href={`/applications/${id}/edit`} className="w-full sm:w-auto">
            <Button className="w-full sm:w-auto bg-primary hover:bg-primary/90">
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </Link>
        </div>

        {/* Application Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Recipient Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Recipient Name</label>
                <p className="text-base font-medium mt-1">{application.name}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">University</label>
                <p className="text-base font-medium mt-1 flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  {application.university}
                </p>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Email Address</label>
              <p className="text-base font-medium mt-1 flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                {application.email}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Status</label>
              <div className="flex items-center gap-2 mt-1">
                {getStatusIcon(application.status)}
                {getStatusBadge(application.status)}
              </div>
              {application.error && (
                <div className="mt-2 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-md">
                  <p className="text-sm text-red-700 dark:text-red-400 font-medium">Error:</p>
                  <p className="text-sm text-red-600 dark:text-red-300 mt-1">{application.error}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Attachments */}
        {attachments.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Paperclip className="h-5 w-5 text-primary" />
                Attachments ({attachments.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {attachments.map((att, idx) => (
                  <li key={idx} className="flex items-center gap-2 text-sm">
                    <AttachmentPreview
                      id={att._id || att.id}
                      filename={att.filename}
                      content={att.content}
                      contentType={att.contentType}
                    >
                      <div className="flex items-center gap-2 hover:text-foreground transition-colors cursor-pointer">
                        <Paperclip className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">{att.filename}</span>
                        {att.contentType && (
                          <Badge variant="outline" className="text-xs">
                            {att.contentType}
                          </Badge>
                        )}
                      </div>
                    </AttachmentPreview>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Email Template */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              Email Template
            </CardTitle>
            <CardDescription>
              The email content that will be sent to the recipient
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-muted/50 rounded-md p-4 border">
              <pre className="whitespace-pre-wrap text-sm font-mono text-foreground">
                {application.emailText}
              </pre>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

