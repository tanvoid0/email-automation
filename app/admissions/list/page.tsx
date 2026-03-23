"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useToast } from "@/lib/hooks/useToast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  ExternalLink,
  GripVertical,
  LayoutGrid,
  List,
  Loader2,
  Plus,
  School,
} from "lucide-react";
import type { AdmissionApiResponse } from "@/lib/types/admission";
import type { AdmissionStage } from "@/lib/types/admission";
import { ADMISSION_STAGES } from "@/lib/types/admission";
import { admissionChecklistProgress, admissionStageLabel } from "@/lib/utils/admissions";
import { admissionPaymentStatusLabel } from "@/lib/utils/admission-payments";
import {
  computeAdmissionDragResult,
  persistAdmissionReorderPatches,
} from "@/lib/utils/admission-board-dnd";
import { getEarliestAdmissionDeadline } from "@/lib/utils/admission-deadline-display";
import { cn } from "@/lib/utils";

function sortRowsForList(data: AdmissionApiResponse[], stageFilter: string): AdmissionApiResponse[] {
  if (stageFilter === "all") {
    return [...data].sort((a, b) => {
      const si = ADMISSION_STAGES.indexOf(a.stage) - ADMISSION_STAGES.indexOf(b.stage);
      if (si !== 0) return si;
      const so = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
      if (so !== 0) return so;
      return (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "");
    });
  }
  return [...data].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

function sopTitle(a: AdmissionApiResponse) {
  const s = a.sopId;
  if (s && typeof s === "object" && "title" in s) return (s as { title: string }).title;
  return null;
}

function ListRowCells({
  a,
  onStageChangeRequest,
  stageChangeSaving,
}: {
  a: AdmissionApiResponse;
  onStageChangeRequest: (admission: AdmissionApiResponse, stage: AdmissionStage) => void;
  stageChangeSaving: boolean;
}) {
  const nd = getEarliestAdmissionDeadline(a);
  const pct = admissionChecklistProgress(a.checklist ?? []);
  return (
    <>
      <TableCell>
        <Link href={`/admissions/${a._id}`} className="font-medium hover:underline">
          {a.universityName}
        </Link>
        {a.programName && <div className="text-xs text-muted-foreground">{a.programName}</div>}
        {sopTitle(a) && <div className="text-xs text-muted-foreground">SOP: {sopTitle(a)}</div>}
      </TableCell>
      <TableCell className="align-middle" onClick={(e) => e.stopPropagation()}>
        <Select
          value={a.stage}
          disabled={stageChangeSaving}
          onValueChange={(v) => onStageChangeRequest(a, v as AdmissionStage)}
        >
          <SelectTrigger
            className="h-8 w-[min(100%,12rem)] max-w-[220px]"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper">
            {ADMISSION_STAGES.map((s) => (
              <SelectItem key={s} value={s}>
                {admissionStageLabel(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="w-40">
        <div className="flex items-center gap-2">
          <Progress value={pct} className="h-2 flex-1" />
          <span className="text-xs text-muted-foreground w-8">{pct}%</span>
        </div>
      </TableCell>
      <TableCell className="text-sm">
        {nd ? (
          <>
            <div>{nd.label}</div>
            <div className="text-xs text-muted-foreground">{nd.date}</div>
          </>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="text-sm">
        {(() => {
          const pays = a.payments ?? [];
          if (pays.length === 0) {
            return <span className="text-muted-foreground">—</span>;
          }
          return (
            <div className="space-y-1">
              {pays.slice(0, 2).map((p) => (
                <div key={p._id} className="text-xs">
                  <span>{admissionPaymentStatusLabel(p.status)}</span>
                  {p.amountText?.trim() && (
                    <span className="text-muted-foreground">
                      {" "}
                      · {p.amountText.trim()}
                      {p.currency ? ` ${p.currency}` : ""}
                    </span>
                  )}
                </div>
              ))}
              {pays.length > 2 && (
                <div className="text-xs text-muted-foreground">+{pays.length - 2} more</div>
              )}
            </div>
          );
        })()}
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1">
          {a.applicationUrl && (
            <a
              href={a.applicationUrl}
              target="_blank"
              rel="noreferrer"
              className="text-primary inline-flex items-center text-xs"
              onClick={(e) => e.stopPropagation()}
            >
              Apply <ExternalLink className="h-3 w-3 ml-0.5" />
            </a>
          )}
          {a.scholarshipUrl && (
            <a
              href={a.scholarshipUrl}
              target="_blank"
              rel="noreferrer"
              className="text-primary inline-flex items-center text-xs"
              onClick={(e) => e.stopPropagation()}
            >
              Aid <ExternalLink className="h-3 w-3 ml-0.5" />
            </a>
          )}
        </div>
      </TableCell>
    </>
  );
}

function SortableListRow({
  admission,
  onStageChangeRequest,
  stageChangeSaving,
}: {
  admission: AdmissionApiResponse;
  onStageChangeRequest: (admission: AdmissionApiResponse, stage: AdmissionStage) => void;
  stageChangeSaving: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: admission._id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className={cn("hover:bg-muted/50", isDragging && "opacity-50")}
    >
      <TableCell className="w-10 pr-2 align-middle">
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing p-1 rounded-md hover:bg-muted"
          {...listeners}
          {...attributes}
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      </TableCell>
      <ListRowCells
        a={admission}
        onStageChangeRequest={onStageChangeRequest}
        stageChangeSaving={stageChangeSaving}
      />
    </TableRow>
  );
}

export default function AdmissionsListPage() {
  const toast = useToast();
  const [rows, setRows] = useState<AdmissionApiResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [stageChangePending, setStageChangePending] = useState<{
    admission: AdmissionApiResponse;
    to: AdmissionStage;
  } | null>(null);
  const [stageChangeSaving, setStageChangeSaving] = useState(false);

  const allowReorder = stageFilter !== "all";

  const requestStageChange = (admission: AdmissionApiResponse, to: AdmissionStage) => {
    if (to === admission.stage) return;
    setStageChangePending({ admission, to });
  };

  const confirmStageChange = async () => {
    if (!stageChangePending) return;
    const { admission, to } = stageChangePending;
    setStageChangeSaving(true);
    try {
      const res = await fetch(`/api/admissions/${admission._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: to }),
      });
      if (!res.ok) throw new Error("Update failed");

      if (stageFilter !== "all" && to !== stageFilter) {
        setRows((prev) =>
          sortRowsForList(
            prev.filter((r) => r._id !== admission._id),
            stageFilter
          )
        );
      } else {
        setRows((prev) =>
          sortRowsForList(
            prev.map((r) => (r._id === admission._id ? { ...r, stage: to } : r)),
            stageFilter
          )
        );
      }
      setStageChangePending(null);
      toast.success("Stage updated");
    } catch {
      toast.error("Could not update stage");
    } finally {
      setStageChangeSaving(false);
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const q = stageFilter !== "all" ? `?stage=${encodeURIComponent(stageFilter)}` : "";
      const res = await fetch(`/api/admissions${q}`);
      if (!res.ok) throw new Error("Failed to load");
      const data: AdmissionApiResponse[] = await res.json();
      setRows(sortRowsForList(data, stageFilter));
    } catch {
      toast.error("Could not load your applications");
    } finally {
      setLoading(false);
    }
  }, [stageFilter, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const onDragStart = (e: DragStartEvent) => {
    setActiveId(String(e.active.id));
  };

  const onDragEnd = async (e: DragEndEvent) => {
    setActiveId(null);
    if (!allowReorder) return;
    const { active, over } = e;
    if (!over) return;
    const result = computeAdmissionDragResult(rows, String(active.id), String(over.id));
    if (!result) return;

    const { nextRows, patches } = result;
    setRows(sortRowsForList(nextRows, stageFilter));

    try {
      const ok = await persistAdmissionReorderPatches(patches);
      if (!ok) throw new Error("Update failed");
    } catch {
      toast.error("Could not save order");
      await load();
    }
  };

  const activeAdmission = activeId ? rows.find((a) => a._id === activeId) : null;

  if (loading) {
    return (
      <main className="min-h-screen bg-background p-4 md:p-8 flex items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="text-muted-foreground">Loading applications…</span>
      </main>
    );
  }

  const table = (
    <Table>
      <TableHeader>
        <TableRow>
          {allowReorder && <TableHead className="w-10 pr-2" aria-label="Reorder" />}
          <TableHead>University</TableHead>
          <TableHead>Stage</TableHead>
          <TableHead>Progress</TableHead>
          <TableHead>Next deadline</TableHead>
          <TableHead>App fee</TableHead>
          <TableHead>Links</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {allowReorder ? (
          <SortableContext items={rows.map((r) => r._id)} strategy={verticalListSortingStrategy}>
            {rows.map((a) => (
              <SortableListRow
                key={a._id}
                admission={a}
                onStageChangeRequest={requestStageChange}
                stageChangeSaving={stageChangeSaving}
              />
            ))}
          </SortableContext>
        ) : (
          rows.map((a) => (
            <TableRow key={a._id} className="hover:bg-muted/50">
              <ListRowCells
                a={a}
                onStageChangeRequest={requestStageChange}
                stageChangeSaving={stageChangeSaving}
              />
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );

  return (
    <main className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <Link
              href="/"
              className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-2"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Home
            </Link>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <School className="h-8 w-8" />
              Your applications
            </h1>
            <p className="text-muted-foreground mt-1">
              Track university admissions, scholarships, and documents in one place.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/admissions/settings">
              <Button variant="outline">
                <School className="h-4 w-4 mr-2" />
                Settings
              </Button>
            </Link>
            <Link href="/admissions">
              <Button variant="outline">
                <LayoutGrid className="h-4 w-4 mr-2" />
                Board
              </Button>
            </Link>
            <Link href="/admissions/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New application
              </Button>
            </Link>
          </div>
        </div>

        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <List className="h-5 w-5" />
                List view
              </CardTitle>
              <CardDescription>
                {allowReorder
                  ? "Drag the handle to reorder within this stage. Use the Stage column to change status (you will confirm before it saves)."
                  : "Change stage from the Stage column (confirmation required). Filter by one stage to enable drag reorder."}
              </CardDescription>
            </div>
            <div className="w-full sm:w-56">
              <Select value={stageFilter} onValueChange={setStageFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Stage" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All stages</SelectItem>
                  {ADMISSION_STAGES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {admissionStageLabel(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {rows.length === 0 ? (
              <p className="text-muted-foreground text-center py-12">
                No applications yet.{" "}
                <Link href="/admissions/new" className="text-primary underline">
                  Create your first
                </Link>
                .
              </p>
            ) : allowReorder ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCorners}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
              >
                {table}
                <DragOverlay dropAnimation={null}>
                  {activeAdmission ? (
                    <Table>
                      <TableBody>
                        <TableRow className="bg-card border shadow-md">
                          <TableCell className="w-10">
                            <GripVertical className="h-4 w-4 text-muted-foreground" />
                          </TableCell>
                          <TableCell colSpan={6} className="font-medium">
                            {activeAdmission.universityName}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  ) : null}
                </DragOverlay>
              </DndContext>
            ) : (
              table
            )}
          </CardContent>
        </Card>

        <Dialog
          open={!!stageChangePending}
          onOpenChange={(open) => {
            if (!open && !stageChangeSaving) setStageChangePending(null);
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Change pipeline stage?</DialogTitle>
              <DialogDescription asChild>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>
                    Update{" "}
                    <span className="font-medium text-foreground">
                      {stageChangePending?.admission.universityName}
                      {stageChangePending?.admission.programName
                        ? ` — ${stageChangePending.admission.programName}`
                        : ""}
                    </span>
                  </p>
                  {stageChangePending && (
                    <p>
                      <span className="text-foreground">{admissionStageLabel(stageChangePending.admission.stage)}</span>
                      {" → "}
                      <span className="text-foreground">{admissionStageLabel(stageChangePending.to)}</span>
                    </p>
                  )}
                </div>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStageChangePending(null)}
                disabled={stageChangeSaving}
              >
                Cancel
              </Button>
              <Button type="button" onClick={() => void confirmStageChange()} disabled={stageChangeSaving}>
                {stageChangeSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Confirm"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </main>
  );
}
