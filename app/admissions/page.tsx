"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useToast } from "@/lib/hooks/useToast";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CalendarDays, GripVertical, LayoutGrid, List, Loader2, Plus, School } from "lucide-react";
import type { AdmissionApiResponse } from "@/lib/types/admission";
import type { AdmissionStage } from "@/lib/types/admission";
import { ADMISSION_STAGES } from "@/lib/types/admission";
import { admissionChecklistProgress, admissionStageLabel } from "@/lib/utils/admissions";
import { admissionPaymentsNeedAttention } from "@/lib/utils/admission-payments";
import {
  computeAdmissionDragResult,
  persistAdmissionReorderPatches,
} from "@/lib/utils/admission-board-dnd";
import {
  admissionDeadlineCountdownTextClass,
  admissionDeadlineRelativeDayLabel,
  admissionKanbanGroupShellClassName,
  admissionKanbanNestedLeftBorderClass,
  admissionKanbanShellClassName,
  getPrimaryBoardDeadline,
  getSoonestPrimaryDeadlineAmong,
} from "@/lib/utils/admission-deadline-display";
import { cn } from "@/lib/utils";

/**
 * Within a stage column, cluster admissions that share the same university (case-insensitive trim).
 * Group order follows the first appearance of each university in the stage's sortOrder sequence.
 */
function groupAdmissionsByUniversity(
  rows: AdmissionApiResponse[]
): { displayName: string; items: AdmissionApiResponse[] }[] {
  const sorted = [...rows].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const norm = (u: string) => u.trim().toLowerCase();
  const orderKeys: string[] = [];
  const map = new Map<string, { displayName: string; items: AdmissionApiResponse[] }>();
  for (const a of sorted) {
    const k = norm(a.universityName);
    if (!map.has(k)) {
      map.set(k, { displayName: a.universityName.trim(), items: [] });
      orderKeys.push(k);
    }
    map.get(k)!.items.push(a);
  }
  return orderKeys.map((k) => map.get(k)!);
}

function AdmissionDeadlineCountdown({
  admission,
  now,
  compact,
}: {
  admission: AdmissionApiResponse;
  now: Date;
  compact?: boolean;
}) {
  const primary = getPrimaryBoardDeadline(admission);
  if (!primary) return null;
  const relative = admissionDeadlineRelativeDayLabel(primary.t, now);
  const textCls = admissionDeadlineCountdownTextClass(primary.t, now);
  return (
    <div
      className={cn(
        "flex items-center gap-1 text-muted-foreground min-w-0",
        compact ? "mt-1 text-[10px]" : "mt-1.5 text-[10px]"
      )}
    >
      <CalendarDays className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
      <span className="truncate" title={`${primary.label} (${primary.date ?? ""})`}>
        <span className="text-foreground/85">{primary.label}</span>
        <span className="mx-1 text-muted-foreground/70">·</span>
        <span className={cn(textCls || "text-muted-foreground")}>{relative}</span>
      </span>
    </div>
  );
}

function KanbanCardChrome({
  admission,
  dragHandle,
  isOverlay,
  isDragging,
  now,
}: {
  admission: AdmissionApiResponse;
  dragHandle: React.ReactNode;
  isOverlay?: boolean;
  isDragging?: boolean;
  now: Date;
}) {
  const pct = admissionChecklistProgress(admission.checklist ?? []);
  const shell = admissionKanbanShellClassName(admission, now);

  return (
    <div
      className={cn(
        "rounded-lg border p-3 shadow-sm touch-none transition-colors",
        shell,
        isDragging && !isOverlay && "opacity-40",
        isOverlay && "shadow-lg ring-2 ring-primary cursor-grabbing"
      )}
    >
      <div className="flex items-start gap-2">
        {dragHandle}
        <div className="flex-1 min-w-0">
          <Link href={`/admissions/${admission._id}`} className="font-medium hover:underline block truncate">
            {admission.universityName}
          </Link>
          {admission.programName && (
            <p className="text-xs text-muted-foreground truncate">{admission.programName}</p>
          )}
          <AdmissionDeadlineCountdown admission={admission} now={now} />
          <div className="flex items-center gap-2 mt-2">
            <Progress value={pct} className="h-1.5 flex-1" />
            <span className="text-[10px] text-muted-foreground">{pct}%</span>
          </div>
          {admissionPaymentsNeedAttention(admission.stage, admission.payments ?? []) && (
            <Badge variant="outline" className="mt-1.5 text-[10px] border-amber-600 text-amber-800 dark:text-amber-200">
              App fee
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

function KanbanSortableCard({ admission, now }: { admission: AdmissionApiResponse; now: Date }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: admission._id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <KanbanCardChrome
        admission={admission}
        now={now}
        isDragging={isDragging}
        dragHandle={
          <button
            type="button"
            className="mt-0.5 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing shrink-0"
            {...listeners}
            {...attributes}
            aria-label="Drag to reorder or move column"
          >
            <GripVertical className="h-4 w-4" />
          </button>
        }
      />
    </div>
  );
}

/** Sub-row when multiple programs share a university in the same column (Jira-style subtasks). */
function KanbanSortableNestedRow({ admission, now }: { admission: AdmissionApiResponse; now: Date }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: admission._id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const pct = admissionChecklistProgress(admission.checklist ?? []);
  const title = admission.programName?.trim() || "Program / track";
  const shell = admissionKanbanShellClassName(admission, now);
  const leftBorder = admissionKanbanNestedLeftBorderClass(admission, now);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-md border pl-2 ml-3 border-l-[3px] shadow-sm transition-colors",
        shell,
        leftBorder,
        isDragging && "opacity-40"
      )}
    >
      <div className="flex items-start gap-1.5 py-2 pr-2">
        <button
          type="button"
          className="mt-0.5 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing shrink-0"
          {...listeners}
          {...attributes}
          aria-label="Drag to reorder or move column"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="flex-1 min-w-0">
          <Link href={`/admissions/${admission._id}`} className="text-sm font-medium hover:underline block truncate">
            {title}
          </Link>
          <AdmissionDeadlineCountdown admission={admission} now={now} compact />
          <div className="flex items-center gap-2 mt-1.5">
            <Progress value={pct} className="h-1 flex-1" />
            <span className="text-[10px] text-muted-foreground tabular-nums">{pct}%</span>
          </div>
          {admissionPaymentsNeedAttention(admission.stage, admission.payments ?? []) && (
            <Badge variant="outline" className="mt-1 text-[10px] border-amber-600 text-amber-800 dark:text-amber-200">
              App fee
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

function KanbanNestedRowOverlay({ admission, now }: { admission: AdmissionApiResponse; now: Date }) {
  const pct = admissionChecklistProgress(admission.checklist ?? []);
  const title = admission.programName?.trim() || "Program / track";
  const shell = admissionKanbanShellClassName(admission, now);
  const leftBorder = admissionKanbanNestedLeftBorderClass(admission, now);
  return (
    <div
      className={cn(
        "rounded-md border pl-2 ml-1 border-l-[3px] shadow-lg ring-2 ring-primary cursor-grabbing",
        shell,
        leftBorder
      )}
    >
      <div className="flex items-start gap-1.5 py-2 pr-2">
        <span className="mt-0.5 text-muted-foreground shrink-0" aria-hidden>
          <GripVertical className="h-4 w-4" />
        </span>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium block truncate">{title}</span>
          <AdmissionDeadlineCountdown admission={admission} now={now} compact />
          <div className="flex items-center gap-2 mt-1.5">
            <Progress value={pct} className="h-1 flex-1" />
            <span className="text-[10px] text-muted-foreground tabular-nums">{pct}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function UniversityKanbanGroup({
  displayName,
  items,
  now,
}: {
  displayName: string;
  items: AdmissionApiResponse[];
  now: Date;
}) {
  const groupShell = admissionKanbanGroupShellClassName(items, now);
  const soon = getSoonestPrimaryDeadlineAmong(items);
  return (
    <div
      className={cn("rounded-lg border shadow-sm overflow-hidden transition-colors", groupShell)}
      role="group"
      aria-label={`${displayName}, ${items.length} programs`}
    >
      <div className="px-3 py-2 border-b border-border/60 bg-muted/30">
        <span className="text-sm font-semibold leading-tight block truncate">{displayName}</span>
        {soon && (
          <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground min-w-0">
            <CalendarDays className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
            <span className="truncate" title={`${soon.label} (${soon.date ?? ""})`}>
              <span className="text-foreground/80">Soonest</span>
              <span className="mx-1 text-muted-foreground/70">·</span>
              <span className={cn(admissionDeadlineCountdownTextClass(soon.t, now) || "text-muted-foreground")}>
                {soon.label}: {admissionDeadlineRelativeDayLabel(soon.t, now)}
              </span>
            </span>
          </div>
        )}
      </div>
      <div className="p-2 flex flex-col gap-1.5">
        {items.map((a) => (
          <KanbanSortableNestedRow key={a._id} admission={a} now={now} />
        ))}
      </div>
    </div>
  );
}

function admissionUsesNestedBoardRow(admission: AdmissionApiResponse, allRows: AdmissionApiResponse[]): boolean {
  const sameStage = allRows.filter((a) => a.stage === admission.stage);
  const groups = groupAdmissionsByUniversity(sameStage);
  return groups.some((g) => g.items.length > 1 && g.items.some((x) => x._id === admission._id));
}

function KanbanColumn({
  stage,
  count,
  children,
}: {
  stage: AdmissionStage;
  count: number;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `col-${stage}` });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col rounded-xl border bg-muted/30 min-h-[320px] w-[280px] shrink-0 p-2 gap-2 transition-colors",
        isOver && "bg-primary/10 border-primary/40"
      )}
    >
      <div className="flex items-center justify-between px-1 pb-1 border-b border-border/60">
        <span className="text-sm font-semibold">{admissionStageLabel(stage)}</span>
        <Badge variant="secondary" className="text-[10px]">
          {count}
        </Badge>
      </div>
      <div className="flex flex-col gap-2 flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}

export default function AdmissionsBoardPage() {
  const toast = useToast();
  const [rows, setRows] = useState<AdmissionApiResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [nowTick, setNowTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setNowTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const now = useMemo(() => new Date(), [nowTick]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admissions");
      if (!res.ok) throw new Error("Failed to load");
      const data: AdmissionApiResponse[] = await res.json();
      data.sort((a, b) => {
        const si = ADMISSION_STAGES.indexOf(a.stage) - ADMISSION_STAGES.indexOf(b.stage);
        if (si !== 0) return si;
        const so = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
        if (so !== 0) return so;
        return (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "");
      });
      setRows(data);
    } catch {
      toast.error("Could not load applications");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const onDragStart = (e: DragStartEvent) => {
    setActiveId(String(e.active.id));
  };

  const onDragEnd = async (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const activeAdmissionId = String(active.id);
    const overId = String(over.id);

    const result = computeAdmissionDragResult(rows, activeAdmissionId, overId);
    if (!result) return;

    const { nextRows, patches } = result;
    setRows(nextRows);

    try {
      const ok = await persistAdmissionReorderPatches(patches);
      if (!ok) throw new Error("Update failed");
    } catch {
      toast.error("Could not save order");
      await load();
    }
  };

  const activeAdmission = activeId ? rows.find((a) => a._id === activeId) : null;

  const byStage = (s: AdmissionStage) =>
    rows
      .filter((a) => a.stage === s)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center gap-2 p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="text-muted-foreground">Loading board…</span>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-[100vw] overflow-x-auto">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 mb-6 min-w-max lg:min-w-0">
          <div>
            <Link
              href="/"
              className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-2"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Home
            </Link>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <LayoutGrid className="h-7 w-7 md:h-8 md:w-8" />
              Your applications
            </h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-xl">
              Multiple programs at the same university group into one card with indented rows. Each card shows the next
              application deadline as a relative date (updates every minute). Borders and backgrounds reflect deadline
              urgency, pipeline stage, and decision. Drag to reorder or change stage; order is saved per stage.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Link href="/admissions/settings">
              <Button variant="outline">
                <School className="h-4 w-4 mr-2" />
                Settings
              </Button>
            </Link>
            <Button variant="outline" asChild>
              <Link href="/admissions/list">
                <List className="h-4 w-4 mr-2" />
                List view
              </Link>
            </Button>
            <Button asChild>
              <Link href="/admissions/new">
                <Plus className="h-4 w-4 mr-2" />
                New application
              </Link>
            </Button>
          </div>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        >
          <div className="flex gap-3 pb-8 min-w-max">
            {ADMISSION_STAGES.map((stage) => {
              const col = byStage(stage);
              const groups = groupAdmissionsByUniversity(col);
              const ids = groups.flatMap((g) => g.items.map((a) => a._id));
              return (
                <KanbanColumn key={stage} stage={stage} count={col.length}>
                  <SortableContext items={ids} strategy={verticalListSortingStrategy}>
                    {groups.map((g) =>
                      g.items.length === 1 ? (
                        <KanbanSortableCard key={g.items[0]._id} admission={g.items[0]} now={now} />
                      ) : (
                        <UniversityKanbanGroup
                          key={`${g.displayName}-${g.items[0]._id}`}
                          displayName={g.displayName}
                          items={g.items}
                          now={now}
                        />
                      )
                    )}
                  </SortableContext>
                </KanbanColumn>
              );
            })}
          </div>
          <DragOverlay dropAnimation={null}>
            {activeAdmission ? (
              admissionUsesNestedBoardRow(activeAdmission, rows) ? (
                <KanbanNestedRowOverlay admission={activeAdmission} now={now} />
              ) : (
                <KanbanCardChrome
                  admission={activeAdmission}
                  now={now}
                  isOverlay
                  dragHandle={
                    <span className="mt-0.5 text-muted-foreground shrink-0" aria-hidden>
                      <GripVertical className="h-4 w-4" />
                    </span>
                  }
                />
              )
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </main>
  );
}
