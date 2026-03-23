"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useToast } from "@/lib/hooks/useToast";
import { useEmailQueue } from "@/lib/hooks/useEmailQueue";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmailProgress } from "./components/EmailProgress";
import { NotificationBell } from "./components/NotificationBell";
import {
  ArrowRight,
  Bell,
  FileText,
  FolderOpen,
  LayoutTemplate,
  Loader2,
  Mail,
  Paperclip,
  Plus,
  School,
  Settings,
} from "lucide-react";
import { getErrorMessage } from "@/lib/types/errors";
import { APP_NAME, APP_TAGLINE } from "@/lib/constants/app";

export const dynamic = "force-dynamic";

type AppStatus = "pending" | "sending" | "sent" | "error" | "cancelled";

interface DashboardStats {
  outreachApplications: {
    total: number;
    byStatus: Record<AppStatus, number>;
  };
  admissionApplications: { total: number };
  sops: { total: number };
  attachments: { total: number };
  sopTemplates: { total: number };
  notifications: { unread: number };
}

export default function DashboardPage() {
  const toast = useToast();
  const emailQueue = useEmailQueue();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/dashboard/stats");
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Failed to load stats");
        }
        const data: DashboardStats = await res.json();
        setStats(data);
      } catch (e: unknown) {
        toast.error(getErrorMessage(e) || "Could not load dashboard");
      } finally {
        setLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once on mount
  }, []);

  const pending = stats?.outreachApplications.byStatus.pending ?? 0;
  const sent = stats?.outreachApplications.byStatus.sent ?? 0;

  return (
    <main className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{APP_NAME}</h1>
            <p className="text-muted-foreground mt-1 max-w-xl">{APP_TAGLINE}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <NotificationBell />
            <Link href="/settings">
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
            </Link>
          </div>
        </div>

        {emailQueue.progress.total > 0 && (
          <EmailProgress
            progress={emailQueue.progress}
            onPause={emailQueue.pause}
            onResume={emailQueue.resume}
            onClear={emailQueue.clear}
            onClearCompleted={emailQueue.clearCompleted}
            isProcessing={emailQueue.isProcessing}
          />
        )}

        <section>
          <h2 className="text-lg font-semibold mb-3">Overview</h2>
          {loading ? (
            <div className="flex items-center gap-3 py-12 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              Loading your stats…
            </div>
          ) : stats ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Email outreach</CardDescription>
                  <CardTitle className="text-3xl tabular-nums">
                    {stats.outreachApplications.total}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  {pending} pending · {sent} sent
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Admission tracking</CardDescription>
                  <CardTitle className="text-3xl tabular-nums">
                    {stats.admissionApplications.total}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Universities and programs in your pipeline
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Statements of purpose</CardDescription>
                  <CardTitle className="text-3xl tabular-nums">{stats.sops.total}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  {stats.sopTemplates.total} template
                  {stats.sopTemplates.total === 1 ? "" : "s"}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Attachments</CardDescription>
                  <CardTitle className="text-3xl tabular-nums">{stats.attachments.total}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Files available for emails and applications
                </CardContent>
              </Card>
            </div>
          ) : null}
        </section>

        {stats && stats.notifications.unread > 0 && (
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
              <Bell className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">
                {stats.notifications.unread} unread notification
                {stats.notifications.unread === 1 ? "" : "s"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Use the bell in the top bar to read and clear notifications.
              </p>
            </CardContent>
          </Card>
        )}

        <section>
          <h2 className="text-lg font-semibold mb-3">Where to next</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Link href="/admissions" className="group block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Card className="h-full transition-colors group-hover:bg-muted/50">
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <School className="h-5 w-5 text-primary" />
                      <CardTitle className="text-lg">Admissions</CardTitle>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                  <CardDescription>
                    Track stages, deadlines, checklists, and program links.
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
            <Link
              href="/applications"
              className="group block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Card className="h-full transition-colors group-hover:bg-muted/50">
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Mail className="h-5 w-5 text-primary" />
                      <CardTitle className="text-lg">Email &amp; outreach</CardTitle>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                  <CardDescription>
                    Professor outreach list, templates, attachments, and send queue.
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
            <Link href="/sop" className="group block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Card className="h-full transition-colors group-hover:bg-muted/50">
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-primary" />
                      <CardTitle className="text-lg">SOPs</CardTitle>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                  <CardDescription>Drafts linked to applications and admissions.</CardDescription>
                </CardHeader>
              </Card>
            </Link>
            <Link
              href="/sop/templates"
              className="group block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Card className="h-full transition-colors group-hover:bg-muted/50">
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <LayoutTemplate className="h-5 w-5 text-primary" />
                      <CardTitle className="text-lg">SOP templates</CardTitle>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                  <CardDescription>Reusable section layouts for new statements.</CardDescription>
                </CardHeader>
              </Card>
            </Link>
            <Link
              href="/attachments"
              className="group block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Card className="h-full transition-colors group-hover:bg-muted/50">
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Paperclip className="h-5 w-5 text-primary" />
                      <CardTitle className="text-lg">Attachments</CardTitle>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                  <CardDescription>Upload and manage files used across the app.</CardDescription>
                </CardHeader>
              </Card>
            </Link>
            <Link href="/settings" className="group block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Card className="h-full transition-colors group-hover:bg-muted/50">
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Settings className="h-5 w-5 text-primary" />
                      <CardTitle className="text-lg">Settings</CardTitle>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                  <CardDescription>Account, email, and template defaults.</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">Quick add</h2>
          <div className="flex flex-wrap gap-2">
            <Link href="/admissions/new">
              <Button variant="secondary" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Admission application
              </Button>
            </Link>
            <Link href="/applications/new">
              <Button variant="secondary" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Outreach application
              </Button>
            </Link>
            <Link href="/sop/new">
              <Button variant="secondary" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                New SOP
              </Button>
            </Link>
            <Link href="/attachments">
              <Button variant="outline" size="sm">
                <FolderOpen className="h-4 w-4 mr-2" />
                Browse attachments
              </Button>
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
