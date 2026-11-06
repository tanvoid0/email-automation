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
import { Bell, ChevronRight, LayoutTemplate, Loader2, Plus } from "lucide-react";
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
              Open the bell to read and clear them.
            </p>
          </CardContent>
        </Card>
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
