"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ChevronRight,
  Eye,
  File,
  FileImage,
  FileText,
  Loader2,
  Mail,
  MailPlus,
  Plus,
  RefreshCw,
  School,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useToast } from "@/lib/hooks/useToast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader } from "@/app/components/PageHeader";
import { formatFileSize, fileToAttachment } from "@/lib/utils/attachments";
import type { AttachmentWithUsage as Item } from "@/lib/types/attachment-usage";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const MAX_BYTES = 10 * 1024 * 1024;
type Filter = "all" | "used" | "unused";

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function fileKind(item: Pick<Item, "filename" | "contentType">) {
  const ext = item.filename.includes(".") ? item.filename.split(".").pop()!.toUpperCase() : "";
  const type = item.contentType ?? "";
  const Icon = type.startsWith("image/") ? FileImage : /pdf|word|text|document/.test(type) ? FileText : File;
  return { Icon, label: ext || type.split("/").pop()?.toUpperCase() || "File" };
}

function relativeDate(iso?: string) {
  if (!iso) return null;
  const days = Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000);
  if (days > -30) return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(days, "day");
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" });
}

function metaLine(item: Item) {
  return [fileKind(item).label, item.size ? formatFileSize(item.size) : null, relativeDate(item.createdAt)]
    .filter(Boolean)
    .join(" · ");
}

/** Keeps the end of long names visible ("…_v3_final.pdf") — that's where versions live. */
function FileName({ name, className }: { name: string; className?: string }) {
  const split = name.length > 28 ? name.length - 12 : name.length;
  return (
    <span className={cn("flex min-w-0 text-sm font-medium", className)} title={name}>
      <span className="truncate">{name.slice(0, split)}</span>
      <span className="shrink-0">{name.slice(split)}</span>
    </span>
  );
}

function usageSummary(item: Item) {
  return [
    item.outreach.length > 0 && { Icon: Mail, text: plural(item.outreach.length, "email") },
    item.admissions.length > 0 && { Icon: School, text: plural(item.admissions.length, "admission") },
    item.inTemplate && { Icon: MailPlus, text: "Email template" },
  ].filter(Boolean) as Array<{ Icon: typeof Mail; text: string }>;
}

function UsedIn({ item, className }: { item: Item; className?: string }) {
  const parts = usageSummary(item);
  if (parts.length === 0) {
    return (
      <span className={cn("text-xs text-muted-foreground", className)}>
        <span className="rounded-full border border-dashed px-2 py-0.5">Not used</span>
      </span>
    );
  }
  return (
    <span className={cn("flex flex-wrap gap-1.5", className)}>
      {parts.map(({ Icon, text }) => (
        <span
          key={text}
          className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground"
        >
          <Icon className="h-3 w-3" aria-hidden />
          {text}
        </span>
      ))}
    </span>
  );
}

/** "14 outreach emails, 3 university applications and your default email template" */
function usageSentence(item: Item) {
  const parts = [
    item.outreach.length && plural(item.outreach.length, "outreach email"),
    item.admissions.length && plural(item.admissions.length, "university application"),
    item.inTemplate && "your default email template",
  ].filter(Boolean) as string[];
  return parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}` : parts[0] ?? "";
}

export default function AttachmentsPage() {
  const toast = useToast();
  const [items, setItems] = useState<Item[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Item | null>(null);
  const [replaceFile, setReplaceFile] = useState<File | null>(null);
  const [deleteOld, setDeleteOld] = useState(true);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewIds, setReviewIds] = useState<Set<string>>(new Set());
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);

  const uploadInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    try {
      const res = await fetch("/api/attachments/with-references");
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
      setItems(await res.json());
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Could not load attachments");
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once on mount
  }, []);

  const unused = useMemo(() => (items ?? []).filter((i) => i.referenceCount === 0), [items]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (items ?? []).filter(
      (i) =>
        (!q || i.filename.toLowerCase().includes(q)) &&
        (filter === "all" || (filter === "used") === i.referenceCount > 0)
    );
  }, [items, query, filter]);
  const selected = items?.find((i) => i._id === selectedId) ?? null;

  const tooBig = (files: File[]) => {
    const big = files.filter((f) => f.size > MAX_BYTES);
    if (big.length) toast.error(`Over the 10 MB limit: ${big.map((f) => f.name).join(", ")}`);
    return files.filter((f) => f.size <= MAX_BYTES);
  };

  const uploadOne = async (file: File): Promise<string> => {
    const res = await fetch("/api/attachments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(await fileToAttachment(file)),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Upload failed (${res.status})`);
    return String(data._id);
  };

  const handleUpload = async () => {
    setBusy(true);
    const results = await Promise.allSettled(uploadFiles.map(uploadOne));
    const failed = uploadFiles.filter((_, i) => results[i].status === "rejected");
    const done = uploadFiles.length - failed.length;
    if (done) toast.success(`Uploaded ${plural(done, "file")}`);
    if (failed.length) {
      toast.error(`Couldn't upload ${failed.map((f) => f.name).join(", ")}. Try again.`);
      setUploadFiles(failed);
    } else {
      setUploadOpen(false);
    }
    setBusy(false);
    await load();
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/attachments/${confirmDelete._id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Delete failed");
      toast.success(
        data.detachedFrom
          ? `Deleted ${confirmDelete.filename} and removed it from ${plural(data.detachedFrom, "place")}`
          : `Deleted ${confirmDelete.filename}`
      );
      setConfirmDelete(null);
      setSelectedId(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  };

  const handleReplace = async () => {
    if (!selected || !replaceFile) return;
    setBusy(true);
    try {
      const newId = await uploadOne(replaceFile);
      const res = await fetch(`/api/attachments/${selected._id}/replace`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newId, deleteOld }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Replace failed");
      toast.success(
        data.replacedIn
          ? `Replaced in ${plural(data.replacedIn, "place")} with ${replaceFile.name}`
          : `Uploaded ${replaceFile.name}`
      );
      setReplaceFile(null);
      setSelectedId(newId);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Replace failed");
    } finally {
      setBusy(false);
    }
  };

  const handleCleanup = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/attachments/cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [...reviewIds] }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Cleanup failed");
      toast.success(`Deleted ${plural(data.dangling?.deletedCount ?? 0, "unused file")}`);
      setReviewOpen(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Cleanup failed");
    } finally {
      setBusy(false);
    }
  };

  if (!items) {
    return (
      <div className="flex min-h-[50dvh] flex-col items-center justify-center gap-3 p-4 text-center">
        {loadError ? (
          <>
            <p className="text-sm text-muted-foreground">Couldn&apos;t load attachments: {loadError}</p>
            <Button variant="outline" onClick={load}>
              <RefreshCw /> Try again
            </Button>
          </>
        ) : (
          <>
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading attachments…</p>
          </>
        )}
      </div>
    );
  }

  const filters: Array<[Filter, string, number]> = [
    ["all", "All", items.length],
    ["used", "In use", items.length - unused.length],
    ["unused", "Not used", unused.length],
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 md:p-8">
      <PageHeader
        title="Attachments"
        description="Upload a file once, then attach it to outreach emails and university applications."
        actions={
          <Button
            onClick={() => {
              setUploadFiles([]);
              setUploadOpen(true);
            }}
          >
            <Plus /> Upload files
          </Button>
        }
      />

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed px-6 py-12 text-center">
          <File className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
          <p className="mt-3 font-medium">No attachments yet</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Upload your CV, transcript and other documents here, then reuse them across emails and applications.
          </p>
          <Button className="mt-4" onClick={() => setUploadOpen(true)}>
            <Upload /> Upload files
          </Button>
        </div>
      ) : (
        <>
          {unused.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/40 px-4 py-3 text-sm">
              <p>
                {unused.length === 1 ? "1 file isn't" : `${unused.length} files aren't`} attached to anything.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setReviewIds(new Set(unused.map((i) => i._id)));
                  setReviewOpen(true);
                }}
              >
                Review
              </Button>
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative sm:max-w-xs sm:flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search files"
                aria-label="Search files"
                className="pl-9"
              />
            </div>
            <div className="flex gap-1 rounded-lg bg-muted p-1" role="group" aria-label="Filter files">
              {filters.map(([key, label, count]) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={filter === key}
                  onClick={() => setFilter(key)}
                  className={cn(
                    "flex h-8 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex-none",
                    filter === key ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {label}
                  <span className="tabular-nums text-xs text-muted-foreground">{count}</span>
                </button>
              ))}
            </div>
          </div>

          {visible.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No files match.</p>
          ) : (
            <ul className="divide-y overflow-hidden rounded-lg border">
              {visible.map((item) => {
                const { Icon } = fileKind(item);
                return (
                  <li key={item._id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(item._id)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none active:bg-muted"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                        <Icon className="h-[18px] w-[18px]" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <FileName name={item.filename} />
                        <span className="mt-0.5 block text-xs text-muted-foreground">{metaLine(item)}</span>
                        <UsedIn item={item} className="mt-2 sm:hidden" />
                      </span>
                      <UsedIn item={item} className="hidden shrink-0 justify-end sm:flex" />
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      {/* File detail */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelectedId(null)}>
        {selected && (
          <DialogContent className="max-w-xl">
            <DialogHeader className="pr-8 text-left">
              <DialogTitle className="break-words leading-snug">{selected.filename}</DialogTitle>
              <DialogDescription>
                {[fileKind(selected).label, selected.size ? formatFileSize(selected.size) : null].filter(Boolean).join(" · ")}
                {selected.createdAt &&
                  ` · Uploaded ${new Date(selected.createdAt).toLocaleDateString(undefined, { dateStyle: "medium" })}`}
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href={`/attachments/${selected._id}`}>
                  <Eye /> Preview
                </Link>
              </Button>
              <Button variant="outline" size="sm" onClick={() => replaceInputRef.current?.click()}>
                <RefreshCw /> Replace with new version
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => setConfirmDelete(selected)}
              >
                <Trash2 /> Delete
              </Button>
            </div>

            <div className="space-y-5 border-t pt-4">
              {selected.referenceCount === 0 && (
                <p className="text-sm text-muted-foreground">
                  Not attached to anything yet. Add it from an outreach email or a university application.
                </p>
              )}
              {selected.outreach.length > 0 && (
                <UsageGroup title="Outreach emails" count={selected.outreach.length}>
                  {selected.outreach.map((o) => (
                    <UsageRow key={o.id} href={`/applications/${o.id}`} primary={o.name} secondary={o.email} />
                  ))}
                </UsageGroup>
              )}
              {selected.admissions.length > 0 && (
                <UsageGroup title="University applications" count={selected.admissions.length}>
                  {selected.admissions.map((a) => (
                    <UsageRow key={a.id} href={`/admissions/${a.id}`} primary={a.label} />
                  ))}
                </UsageGroup>
              )}
              {selected.inTemplate && (
                <UsageGroup title="Default email template">
                  <UsageRow href="/settings" primary="Added to every new outreach email" secondary="Manage in Settings" />
                </UsageGroup>
              )}
            </div>
          </DialogContent>
        )}
      </Dialog>

      <input
        ref={replaceInputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const [file] = tooBig(Array.from(e.target.files ?? []));
          e.target.value = "";
          if (file) {
            setDeleteOld(true);
            setReplaceFile(file);
          }
        }}
      />

      {/* Replace confirm */}
      <Dialog open={!!replaceFile} onOpenChange={(open) => !open && !busy && setReplaceFile(null)}>
        {selected && replaceFile && (
          <DialogContent>
            <DialogHeader className="text-left">
              <DialogTitle className="break-words leading-snug">Replace with {replaceFile.name}?</DialogTitle>
              <DialogDescription>
                {selected.referenceCount
                  ? `${usageSentence(selected)} will use the new file instead of ${selected.filename}.`
                  : `${selected.filename} isn't attached to anything, so this just uploads the new file.`}
              </DialogDescription>
            </DialogHeader>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={deleteOld} onCheckedChange={(v) => setDeleteOld(v === true)} />
              Delete the old file afterwards
            </label>
            <DialogFooter>
              <Button variant="outline" onClick={() => setReplaceFile(null)} disabled={busy}>
                Cancel
              </Button>
              <Button onClick={handleReplace} disabled={busy}>
                {busy ? <Loader2 className="animate-spin" /> : <RefreshCw />} Replace
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!confirmDelete} onOpenChange={(open) => !open && !busy && setConfirmDelete(null)}>
        {confirmDelete && (
          <DialogContent>
            <DialogHeader className="text-left">
              <DialogTitle>Delete this file?</DialogTitle>
              <DialogDescription className="break-words">{confirmDelete.filename}</DialogDescription>
            </DialogHeader>
            <p className="text-sm">
              {confirmDelete.referenceCount
                ? `It will be removed from ${usageSentence(confirmDelete)}. This can't be undone.`
                : "It isn't attached to anything. This can't be undone."}
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmDelete(null)} disabled={busy}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDelete} disabled={busy}>
                {busy ? <Loader2 className="animate-spin" /> : <Trash2 />} Delete file
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {/* Unused review */}
      <Dialog open={reviewOpen} onOpenChange={(open) => !busy && setReviewOpen(open)}>
        <DialogContent className="max-w-lg">
          <DialogHeader className="text-left">
            <DialogTitle>Files not attached to anything</DialogTitle>
            <DialogDescription>
              Keep the ones you&apos;ll need for upcoming applications. Deleting can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <ul className="divide-y rounded-md border">
            {unused.map((item) => (
              <li key={item._id}>
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5">
                  <Checkbox
                    checked={reviewIds.has(item._id)}
                    onCheckedChange={(v) =>
                      setReviewIds((prev) => {
                        const next = new Set(prev);
                        if (v === true) next.add(item._id);
                        else next.delete(item._id);
                        return next;
                      })
                    }
                  />
                  <span className="min-w-0 flex-1">
                    <FileName name={item.filename} />
                    <span className="block text-xs text-muted-foreground">{metaLine(item)}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleCleanup} disabled={busy || reviewIds.size === 0}>
              {busy ? <Loader2 className="animate-spin" /> : <Trash2 />} Delete {plural(reviewIds.size, "file")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload */}
      <Dialog open={uploadOpen} onOpenChange={(open) => !busy && setUploadOpen(open)}>
        <DialogContent className="max-w-lg">
          <DialogHeader className="text-left">
            <DialogTitle>Upload files</DialogTitle>
            <DialogDescription>Up to 10 MB each. Uploading the same file twice reuses the existing copy.</DialogDescription>
          </DialogHeader>
          <Button variant="outline" className="w-full" onClick={() => uploadInputRef.current?.click()} disabled={busy}>
            <Upload /> Choose files
          </Button>
          <input
            ref={uploadInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              setUploadFiles(tooBig(Array.from(e.target.files ?? [])));
              e.target.value = "";
            }}
          />
          {uploadFiles.length > 0 && (
            <ul className="divide-y rounded-md border">
              {uploadFiles.map((file, index) => (
                <li key={`${file.name}-${index}`} className="flex items-center gap-3 py-1.5 pl-3 pr-1">
                  <span className="min-w-0 flex-1">
                    <FileName name={file.name} />
                    <span className="block text-xs text-muted-foreground">{formatFileSize(file.size)}</span>
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${file.name}`}
                    disabled={busy}
                    onClick={() => setUploadFiles((prev) => prev.filter((_, i) => i !== index))}
                  >
                    <X />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={handleUpload} disabled={busy || uploadFiles.length === 0}>
              {busy ? <Loader2 className="animate-spin" /> : <Upload />}
              Upload{uploadFiles.length ? ` ${plural(uploadFiles.length, "file")}` : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function UsageGroup({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-1 flex items-baseline gap-2 text-sm font-medium">
        {title}
        {count !== undefined && <span className="tabular-nums text-xs text-muted-foreground">{count}</span>}
      </h3>
      <ul className="-mx-2">{children}</ul>
    </section>
  );
}

function UsageRow({ href, primary, secondary }: { href: string; primary: string; secondary?: string }) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm">{primary}</span>
          {secondary && <span className="block truncate text-xs text-muted-foreground">{secondary}</span>}
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
    </li>
  );
}
