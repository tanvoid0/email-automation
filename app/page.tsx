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
import { PageHeader } from "./components/PageHeader";
import { AlertTriangle, CheckCircle2, ChevronRight, Info, LayoutTemplate, Loader2, Plus, XCircle } from "lucide-react";
import { getErrorMessage } from "@/lib/types/errors";
import { APP_TAGLINE } from "@/lib/constants/app";

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

interface UnreadNotification {
  _id: string;
  type: "success" | "error" | "warning" | "info";
  title: string;
  message: string;
  createdAt: string;
  metadata?: { applicationId?: string };
}

const NOTIFICATION_STYLE = {
  success: { Icon: CheckCircle2, tone: "text-green-600" },
  error: { Icon: XCircle, tone: "text-destructive" },
  warning: { Icon: AlertTriangle, tone: "text-amber-600" },
  info: { Icon: Info, tone: "text-blue-600" },
};

export default function DashboardPage() {
  const toast = useToast();
  const emailQueue = useEmailQueue();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [unread, setUnread] = useState<UnreadNotification[]>([]);

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
        if (data.notifications.unread > 0) {
          const nRes = await fetch("/api/notifications?read=false&limit=3");
          if (nRes.ok) setUnread((await nRes.json()).notifications ?? []);
        }
      } catch (e: unknown) {
        toast.error(getErrorMessage(e) || "Could not load dashboard");
      } finally {
        setLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once on mount
  }, []);

  const markRead = async (id: string) => {
    const res = await fetch(`/api/notifications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ read: true }),
    });
    if (!res.ok) return toast.error("Couldn't mark it read");
    const remaining = unread.filter((n) => n._id !== id);
    setUnread(remaining);
    const left = Math.max(0, (stats?.notifications.unread ?? 1) - 1);
    setStats((prev) => (prev ? { ...prev, notifications: { unread: left } } : prev));
    if (remaining.length === 0 && left > 0) {
      const nRes = await fetch("/api/notifications?read=false&limit=3");
      if (nRes.ok) setUnread((await nRes.json()).notifications ?? []);
    }
  };

  const pending = stats?.outreachApplications.byStatus.pending ?? 0;
  const sent = stats?.outreachApplications.byStatus.sent ?? 0;

  const statCards = stats
    ? [
        {
          href: "/applications",
          label: "Email outreach",
          value: stats.outreachApplications.total,
          detail: `${pending} pending · ${sent} sent`,
        },
        {
          href: "/admissions",
          label: "Admissions",
          value: stats.admissionApplications.total,
          detail: "Programs in your pipeline",
        },
        {
          href: "/sop",
          label: "SOPs",
          value: stats.sops.total,
          detail: `${stats.sopTemplates.total} template${stats.sopTemplates.total === 1 ? "" : "s"}`,
        },
        {
          href: "/attachments",
          label: "Attachments",
          value: stats.attachments.total,
          detail: "For emails and applications",
        },
      ]
    : [];

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-4 md:p-8">
      <PageHeader title="Dashboard" description={APP_TAGLINE} />

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

      <section aria-labelledby="overview-heading">
        <h2 id="overview-heading" className="mb-3 text-lg font-semibold">
          Overview
        </h2>
        {loading ? (
          <div className="flex items-center gap-3 py-12 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            Loading your stats…
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
            {statCards.map((card) => (
              <Link
                key={card.href}
                href={card.href}
                className="group block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Card className="h-full transition-colors group-hover:bg-muted/50 group-active:bg-muted/70">
                  <CardHeader className="space-y-1 p-4 pb-1 md:p-6 md:pb-2">
                    <CardDescription className="flex items-center justify-between gap-1">
                      {card.label}
                      <ChevronRight className="h-4 w-4 shrink-0 opacity-50 transition-opacity group-hover:opacity-100" aria-hidden />
                    </CardDescription>
                    <CardTitle className="text-3xl tabular-nums">{card.value}</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 text-xs text-muted-foreground md:p-6 md:pt-0 md:text-sm">
                    {card.detail}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      {unread.length > 0 && stats && (
        <section aria-labelledby="unread-heading">
          <h2 id="unread-heading" className="mb-3 flex items-baseline gap-2 text-lg font-semibold">
            Unread notifications
            <span className="text-sm font-normal tabular-nums text-muted-foreground">{stats.notifications.unread}</span>
          </h2>
          <ul className="divide-y overflow-hidden rounded-lg border">
            {unread.map((n) => {
              const { Icon, tone } = NOTIFICATION_STYLE[n.type] ?? NOTIFICATION_STYLE.info;
              return (
                <li key={n._id} className="flex items-start gap-3 px-4 py-3">
                  <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${tone}`} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{n.title}</p>
                    {/* Toast-created notifications often repeat the title as the message */}
                    {n.message && n.message !== n.title && (
                      <p className="mt-0.5 line-clamp-2 break-words text-sm text-muted-foreground">{n.message}</p>
                    )}
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                      <time dateTime={n.createdAt}>{new Date(n.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</time>
                      {n.metadata?.applicationId && (
                        <Link href={`/applications/${n.metadata.applicationId}`} className="font-medium text-foreground underline-offset-4 hover:underline">
                          Open application
                        </Link>
                      )}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" className="shrink-0" onClick={() => markRead(n._id)}>
                    Mark read
                  </Button>
                </li>
              );
            })}
          </ul>
          {stats.notifications.unread > unread.length && (
            <p className="mt-2 text-sm text-muted-foreground">
              {stats.notifications.unread - unread.length} more in the notifications bell.
            </p>
          )}
        </section>
      )}

      <section aria-labelledby="quick-add-heading">
        <h2 id="quick-add-heading" className="mb-3 text-lg font-semibold">
          Quick add
        </h2>
        <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
          <Button variant="secondary" className="justify-start sm:justify-center" asChild>
            <Link href="/admissions/new">
              <Plus />
              Admission application
            </Link>
          </Button>
          <Button variant="secondary" className="justify-start sm:justify-center" asChild>
            <Link href="/applications/new">
              <Plus />
              Outreach application
            </Link>
          </Button>
          <Button variant="secondary" className="justify-start sm:justify-center" asChild>
            <Link href="/sop/new">
              <Plus />
              New SOP
            </Link>
          </Button>
          <Button variant="outline" className="justify-start sm:justify-center" asChild>
            <Link href="/sop/templates">
              <LayoutTemplate />
              SOP templates
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
