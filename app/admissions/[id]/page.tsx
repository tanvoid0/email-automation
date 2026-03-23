"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useToast } from "@/lib/hooks/useToast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
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
  Bot,
  Copy,
  ExternalLink,
  Loader2,
  Mail,
  Plus,
  Save,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import type {
  AdmissionApiResponse,
  AdmissionChecklistItem,
  AdmissionContact,
  AdmissionDeadline,
  AdmissionStage,
} from "@/lib/types/admission";
import { ADMISSION_DECISIONS, ADMISSION_STAGES } from "@/lib/types/admission";
import type { AdmissionPaymentRecord } from "@/lib/types/admissionPayment";
import type { AdmissionResearchResult } from "@/lib/validations/admissionResearch";
import { admissionChecklistProgress, admissionStageLabel, newChecklistItemId } from "@/lib/utils/admissions";
import { admissionPaymentStatusLabel, admissionPaymentsNeedAttention } from "@/lib/utils/admission-payments";
import { AdmissionPaymentsSection } from "@/components/admissions/AdmissionPaymentsSection";
import { fileToAttachment } from "@/lib/utils/attachments";
import type { AttachmentApiResponse } from "@/lib/types/api";

interface SopOption {
  _id: string;
  title: string;
}

export default function AdmissionDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sops, setSops] = useState<SopOption[]>([]);

  const [universityName, setUniversityName] = useState("");
  const [programName, setProgramName] = useState("");
  const [degree, setDegree] = useState("");
  const [country, setCountry] = useState("");
  const [term, setTerm] = useState("");
  const [applicationUrl, setApplicationUrl] = useState("");
  const [scholarshipUrl, setScholarshipUrl] = useState("");
  const [departmentUrl, setDepartmentUrl] = useState("");
  const [statusPortalUrl, setStatusPortalUrl] = useState("");
  const [stage, setStage] = useState<string>("researching");
  const [priority, setPriority] = useState<string>("normal");
  const [decision, setDecision] = useState<string>("unknown");
  const [notes, setNotes] = useState("");
  const [sopId, setSopId] = useState<string>("");
  const [checklist, setChecklist] = useState<AdmissionChecklistItem[]>([]);
  const [deadlines, setDeadlines] = useState<AdmissionDeadline[]>([]);
  const [contacts, setContacts] = useState<AdmissionContact[]>([]);
  const [payments, setPayments] = useState<AdmissionPaymentRecord[]>([]);
  const [attachmentIds, setAttachmentIds] = useState<string[]>([]);
  const [attachmentMeta, setAttachmentMeta] = useState<Map<string, AttachmentApiResponse>>(new Map());

  const [aiLoading, setAiLoading] = useState(false);
  const [aiUrls, setAiUrls] = useState("");
  const [aiFocus, setAiFocus] = useState<"admission" | "scholarship" | "both">("both");
  const [aiResult, setAiResult] = useState<AdmissionResearchResult | null>(null);

  const [emailOpen, setEmailOpen] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const [emailAttachIds, setEmailAttachIds] = useState<string[]>([]);

  const loadAttachmentsMeta = useCallback(async (ids: string[]) => {
    if (ids.length === 0) {
      setAttachmentMeta(new Map());
      return;
    }
    try {
      const res = await fetch("/api/attachments/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) return;
      const list: AttachmentApiResponse[] = await res.json();
      const m = new Map<string, AttachmentApiResponse>();
      list.forEach((a) => m.set(a._id, a));
      setAttachmentMeta(m);
    } catch {
      /* ignore */
    }
  }, []);

  const refreshPayments = useCallback(async () => {
    try {
      const pr = await fetch(`/api/admissions/${id}/payments`);
      if (pr.ok) setPayments(await pr.json());
    } catch {
      /* ignore */
    }
  }, [id]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [adRes, payRes, sopRes] = await Promise.all([
        fetch(`/api/admissions/${id}`),
        fetch(`/api/admissions/${id}/payments`),
        fetch("/api/sop"),
      ]);
      if (!adRes.ok) throw new Error("Not found");
      const a: AdmissionApiResponse = await adRes.json();
      if (payRes.ok) {
        setPayments(await payRes.json());
      }
      setUniversityName(a.universityName);
      setProgramName(a.programName ?? "");
      setDegree(a.degree ?? "");
      setCountry(a.country ?? "");
      setTerm(a.term ?? "");
      setApplicationUrl(a.applicationUrl ?? "");
      setScholarshipUrl(a.scholarshipUrl ?? "");
      setDepartmentUrl(a.departmentUrl ?? "");
      setStatusPortalUrl(a.statusPortalUrl ?? "");
      setStage(a.stage);
      setPriority(a.priority);
      setDecision(a.decision);
      setNotes(a.notes ?? "");
      const sid =
        a.sopId && typeof a.sopId === "object" && "_id" in a.sopId
          ? (a.sopId as { _id: string })._id
          : typeof a.sopId === "string"
            ? a.sopId
            : "";
      setSopId(sid);
      setChecklist(a.checklist ?? []);
      setDeadlines(a.deadlines ?? []);
      setContacts(a.contacts ?? []);
      const att = (a as AdmissionApiResponse & { attachments?: string[] }).attachments ?? [];
      setAttachmentIds(att);
      await loadAttachmentsMeta(att);

      if (sopRes.ok) {
        const sl: SopOption[] = await sopRes.json();
        setSops(sl.map((x) => ({ _id: x._id, title: x.title })));
      }
    } catch {
      toast.error("Could not load application");
      router.push("/admissions");
    } finally {
      setLoading(false);
    }
  }, [id, loadAttachmentsMeta, router, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admissions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          universityName: universityName.trim(),
          programName: programName.trim() || undefined,
          degree: degree.trim() || undefined,
          country: country.trim() || undefined,
          term: term.trim() || undefined,
          applicationUrl: applicationUrl.trim() || undefined,
          scholarshipUrl: scholarshipUrl.trim() || undefined,
          departmentUrl: departmentUrl.trim() || undefined,
          statusPortalUrl: statusPortalUrl.trim() || undefined,
          stage,
          priority,
          decision,
          notes: notes.trim() || undefined,
          sopId: sopId ? sopId : null,
          checklist,
          deadlines,
          contacts,
          attachments: attachmentIds,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      toast.success("Saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this application? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/admissions/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      toast.success("Deleted");
      router.push("/admissions");
    } catch {
      toast.error("Could not delete");
    }
  };

  const runAiResearch = async () => {
    setAiLoading(true);
    setAiResult(null);
    try {
      const optionalUrls = aiUrls
        .split(/\n/)
        .map((u) => u.trim())
        .filter(Boolean)
        .slice(0, 3);
      const res = await fetch("/api/admissions/ai-research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          universityName,
          programName: programName || undefined,
          degree: degree || undefined,
          country: country || undefined,
          term: term || undefined,
          focus: aiFocus,
          optionalUrls,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Research failed");
      setAiResult(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Research failed");
    } finally {
      setAiLoading(false);
    }
  };

  const mergeAiDeadlines = () => {
    if (!aiResult) return;
    const next = [...deadlines];
    for (const d of aiResult.deadlines) {
      next.push({
        label: d.label,
        date: d.dateISO?.slice(0, 10) || undefined,
        type: d.category,
      });
    }
    setDeadlines(next);
    toast.success("Merged AI deadlines (verify dates on official sites)");
  };

  const mergeAiChecklist = () => {
    if (!aiResult) return;
    const items = aiResult.requirements.map((label) => ({
      id: newChecklistItemId(),
      label,
      done: false,
    }));
    setChecklist((c) => [...c, ...items]);
    toast.success("Appended requirements to checklist");
  };

  const mergeAiApplicationFee = async () => {
    if (!aiResult?.fees?.length) return;
    const appFee =
      aiResult.fees.find((f) =>
        /application|app\s*fee|process(ing)?\s*fee|portal\s*fee/i.test(f.description)
      ) ?? aiResult.fees[0];
    try {
      const res = await fetch(`/api/admissions/${id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: (appFee.description ?? "Application fee").slice(0, 200),
          amountText: (appFee.amountText ?? "").trim() || undefined,
          currency: (appFee.currency ?? "").trim() || undefined,
          note: (appFee.notes ?? "").trim() || undefined,
          status: "pending",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not add payment");
      await refreshPayments();
      toast.success("Added payment from research — verify on the official site");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add payment");
    }
  };

  const copyAiSummary = () => {
    if (!aiResult) return;
    const text = [
      ...aiResult.processSteps.map((s, i) => `${i + 1}. ${s}`),
      "",
      aiResult.confidenceNote,
      aiResult.disclaimer,
    ].join("\n");
    void navigator.clipboard.writeText(text);
    toast.success("Copied summary");
  };

  const openEmailComposer = async (preset: "admissions" | "scholarship" | "prof") => {
    let profile: { fullName?: string; email?: string; degree?: string; university?: string } = {};
    try {
      const pr = await fetch("/api/profile");
      if (pr.ok) profile = await pr.json();
    } catch {
      /* ignore */
    }
    const match =
      preset === "admissions"
        ? contacts.find((c) => /admission|graduate|enroll/i.test(c.role))
        : preset === "scholarship"
          ? contacts.find((c) => /aid|scholar|financial/i.test(c.role))
          : contacts.find((c) => /prof|faculty|pi/i.test(c.role));
    setEmailTo(match?.email ?? "");
    setEmailSubject(
      preset === "scholarship"
        ? `Question regarding scholarships — ${universityName}`
        : `Inquiry — ${universityName}${programName ? ` (${programName})` : ""}`
    );
    const lines = [
      `Dear ${match?.name || "Admissions Team"},`,
      "",
      `I am writing regarding my application to ${universityName}${programName ? ` for ${programName}` : ""}.`,
      "",
      `[Your message here]`,
      "",
      `Best regards,`,
      profile.fullName || "[Your name]",
      profile.email || "",
      profile.degree ? `${profile.degree}${profile.university ? `, ${profile.university}` : ""}` : "",
    ].filter(Boolean);
    setEmailBody(lines.join("\n"));
    setEmailAttachIds([]);
    setEmailOpen(true);
  };

  const sendEmail = async () => {
    if (!emailTo.trim() || !emailSubject.trim() || !emailBody.trim()) {
      toast.error("To, subject, and body are required");
      return;
    }
    setEmailSending(true);
    try {
      const res = await fetch("/api/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: emailTo.trim(),
          subject: emailSubject.trim(),
          text: emailBody,
          attachmentIds: emailAttachIds.length ? emailAttachIds : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Send failed");
      toast.success("Email sent");
      setEmailOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Send failed");
    } finally {
      setEmailSending(false);
    }
  };

  const uploadDoc = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const att = await fileToAttachment(file);
      const res = await fetch("/api/attachments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: att.filename,
          content: att.content,
          contentType: att.contentType,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      const newIds = [...attachmentIds, data._id];
      setAttachmentIds(newIds);
      await loadAttachmentsMeta(newIds);
      toast.success("File uploaded — click Save to persist on this application");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    }
  };

  const pct = admissionChecklistProgress(checklist);

  if (loading) {
    return (
      <main className="min-h-screen bg-background p-8 flex justify-center items-center gap-2">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="text-muted-foreground">Loading…</span>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background p-4 md:p-6 pb-24">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <Link href="/admissions" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-2">
              <ArrowLeft className="h-4 w-4 mr-1" />
              All applications
            </Link>
            <h1 className="text-2xl font-bold">{universityName || "Application"}</h1>
            {programName && <p className="text-muted-foreground">{programName}</p>}
            <div className="flex flex-wrap gap-2 mt-2">
              <Badge variant="outline">{admissionStageLabel(stage as (typeof ADMISSION_STAGES)[number])}</Badge>
              <Badge variant="secondary">{priority} priority</Badge>
              {payments.length > 0 && (
                <Badge variant="outline" className="text-xs">
                  {payments.length} payment{payments.length !== 1 ? "s" : ""} ·{" "}
                  {payments.filter((p) => p.status === "pending").length} pending
                </Badge>
              )}
              {payments.slice(0, 3).map((p) => (
                <Badge
                  key={p._id}
                  variant={p.status === "paid" || p.status === "waived" ? "secondary" : "outline"}
                  className="text-xs max-w-[200px] truncate"
                  title={p.label}
                >
                  {p.label}: {admissionPaymentStatusLabel(p.status)}
                  {p.amountText?.trim() ? ` · ${p.amountText.trim()}` : ""}
                </Badge>
              ))}
            </div>
            {admissionPaymentsNeedAttention(
              stage as AdmissionStage,
              payments.map((p) => ({ status: p.status }))
            ) && (
              <p className="text-xs text-amber-800 dark:text-amber-200 mt-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 leading-snug">
                A payment is still <strong>pending</strong>. Pay on the official portal, then mark the row{" "}
                <strong>Paid</strong> in Payments &amp; fees below.
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => openEmailComposer("admissions")}>
              <Mail className="h-4 w-4 mr-1" />
              Email
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
              Save
            </Button>
            <Button variant="destructive" size="icon" onClick={handleDelete} aria-label="Delete">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Progress value={pct} className="h-2 flex-1" />
          <span className="text-sm text-muted-foreground w-12">{pct}%</span>
        </div>

        <Card>
          <CardHeader className="p-4 pb-2 space-y-0.5">
            <CardTitle className="text-base font-semibold">Quick links</CardTitle>
            <CardDescription className="text-xs">Open portals and copy URLs.</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-2 flex flex-wrap gap-1.5">
            {applicationUrl && (
              <Button variant="outline" size="sm" asChild>
                <a href={applicationUrl} target="_blank" rel="noreferrer">
                  Apply <ExternalLink className="h-3 w-3 ml-1" />
                </a>
              </Button>
            )}
            {scholarshipUrl && (
              <Button variant="outline" size="sm" asChild>
                <a href={scholarshipUrl} target="_blank" rel="noreferrer">
                  Scholarships <ExternalLink className="h-3 w-3 ml-1" />
                </a>
              </Button>
            )}
            {departmentUrl && (
              <Button variant="outline" size="sm" asChild>
                <a href={departmentUrl} target="_blank" rel="noreferrer">
                  Department <ExternalLink className="h-3 w-3 ml-1" />
                </a>
              </Button>
            )}
            {statusPortalUrl && (
              <Button variant="outline" size="sm" asChild>
                <a href={statusPortalUrl} target="_blank" rel="noreferrer">
                  Status portal <ExternalLink className="h-3 w-3 ml-1" />
                </a>
              </Button>
            )}
          </CardContent>
        </Card>

        <AdmissionPaymentsSection
          admissionId={id}
          stage={stage as AdmissionStage}
          payments={payments}
          onReload={refreshPayments}
        />

        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-base font-semibold">Overview</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-2 grid gap-2 md:grid-cols-2">
            <div className="space-y-1 md:col-span-2">
              <Label className="text-xs">University</Label>
              <Input className="h-9" value={universityName} onChange={(e) => setUniversityName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Program</Label>
              <Input className="h-9" value={programName} onChange={(e) => setProgramName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Degree</Label>
              <Input className="h-9" value={degree} onChange={(e) => setDegree(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Country</Label>
              <Input className="h-9" value={country} onChange={(e) => setCountry(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Intake term</Label>
              <Input className="h-9" value={term} onChange={(e) => setTerm(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Stage</Label>
              <Select value={stage} onValueChange={setStage}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ADMISSION_STAGES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {admissionStageLabel(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Decision</Label>
              <Select value={decision} onValueChange={setDecision}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ADMISSION_DECISIONS.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label className="text-xs">Application URL</Label>
              <Input
                className="h-9"
                type="url"
                value={applicationUrl}
                onChange={(e) => setApplicationUrl(e.target.value)}
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label className="text-xs">Scholarship URL</Label>
              <Input
                className="h-9"
                type="url"
                value={scholarshipUrl}
                onChange={(e) => setScholarshipUrl(e.target.value)}
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label className="text-xs">Department URL</Label>
              <Input
                className="h-9"
                type="url"
                value={departmentUrl}
                onChange={(e) => setDepartmentUrl(e.target.value)}
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label className="text-xs">Status portal URL</Label>
              <Input
                className="h-9"
                type="url"
                value={statusPortalUrl}
                onChange={(e) => setStatusPortalUrl(e.target.value)}
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label className="text-xs">Notes</Label>
              <Textarea
                className="min-h-[88px] resize-y text-sm py-2"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-2 space-y-1">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Sparkles className="h-4 w-4 shrink-0" />
              Research with AI
            </CardTitle>
            <CardDescription className="text-xs leading-relaxed">
              Draft deadlines, links, and requirements. Always verify on the official site before relying on dates or fees.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-2 space-y-3">
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-950 dark:text-amber-100 leading-snug">
              AI can be wrong or out of date. Treat this as a starting checklist only.
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Focus</Label>
              <Select value={aiFocus} onValueChange={(v) => setAiFocus(v as typeof aiFocus)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="both">Admissions + scholarships</SelectItem>
                  <SelectItem value="admission">Admissions only</SelectItem>
                  <SelectItem value="scholarship">Scholarships only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Optional official URLs (one per line, max 3)</Label>
              <Textarea
                className="min-h-[68px] resize-y text-sm py-2"
                value={aiUrls}
                onChange={(e) => setAiUrls(e.target.value)}
                rows={2}
                placeholder="https://gradadmissions.university.edu/..."
              />
            </div>
            <Button type="button" variant="secondary" onClick={runAiResearch} disabled={aiLoading || !universityName.trim()}>
              {aiLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Bot className="h-4 w-4 mr-2" />}
              Run research
            </Button>
            {aiResult && (
              <div className="space-y-3 border rounded-md p-3 bg-muted/30">
                <p className="text-xs leading-relaxed">{aiResult.confidenceNote}</p>
                <p className="text-[11px] text-muted-foreground leading-snug">{aiResult.disclaimer}</p>
                {aiResult.officialLinks.length > 0 && (
                  <div>
                    <p className="font-medium text-sm mb-2">Suggested links</p>
                    <ul className="text-sm space-y-1">
                      {aiResult.officialLinks.map((l, i) => (
                        <li key={i} className="flex flex-wrap items-center gap-2">
                          <span>{l.label}</span>
                          <a className="text-primary underline" href={l.url} target="_blank" rel="noreferrer">
                            {l.url}
                          </a>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              const k = (l.kind || "").toLowerCase();
                              if (k.includes("scholar") || k.includes("aid")) setScholarshipUrl(l.url);
                              else if (k.includes("apply") || k.includes("portal") || k.includes("admission"))
                                setApplicationUrl(l.url);
                              else setDepartmentUrl(l.url);
                              toast.success("URL copied into a field — review and Save");
                            }}
                          >
                            Use URL
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {aiResult.fees.length > 0 && (
                  <div>
                    <p className="font-medium text-xs mb-1">Fees (from AI)</p>
                    <ul className="text-xs space-y-1.5 text-muted-foreground">
                      {aiResult.fees.map((f, i) => (
                        <li key={i}>
                          <span className="text-foreground font-medium">{f.description}</span>
                          {f.amountText && (
                            <span>
                              {" "}
                              — {f.amountText}
                              {f.currency ? ` ${f.currency}` : ""}
                            </span>
                          )}
                          {f.notes && <div className="text-xs mt-0.5">{f.notes}</div>}
                        </li>
                      ))}
                    </ul>
                    <Button type="button" size="sm" variant="outline" className="mt-2" onClick={mergeAiApplicationFee}>
                      Apply to payment section
                    </Button>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={mergeAiDeadlines}>
                    Add deadlines to list
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={mergeAiChecklist}>
                    Append requirements to checklist
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={copyAiSummary}>
                    <Copy className="h-3 w-3 mr-1" />
                    Copy process summary
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between p-4 pb-2">
            <CardTitle className="text-base font-semibold">Checklist</CardTitle>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                setChecklist((c) => [...c, { id: newChecklistItemId(), label: "New item", done: false }])
              }
            >
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {checklist.length === 0 ? (
              <p className="text-sm text-muted-foreground">No items yet.</p>
            ) : (
              checklist.map((item, idx) => (
                <div key={item.id} className="flex items-start gap-3 border rounded-md p-2">
                  <Checkbox
                    checked={item.done}
                    onCheckedChange={(v) => {
                      const next = [...checklist];
                      next[idx] = { ...item, done: Boolean(v) };
                      setChecklist(next);
                    }}
                    className="mt-2"
                  />
                  <div className="flex-1 space-y-2">
                    <Input
                      value={item.label}
                      onChange={(e) => {
                        const next = [...checklist];
                        next[idx] = { ...item, label: e.target.value };
                        setChecklist(next);
                      }}
                    />
                    <Input
                      type="date"
                      value={item.dueDate?.slice(0, 10) ?? ""}
                      onChange={(e) => {
                        const next = [...checklist];
                        next[idx] = { ...item, dueDate: e.target.value || undefined };
                        setChecklist(next);
                      }}
                    />
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => setChecklist((c) => c.filter((x) => x.id !== item.id))}
                    aria-label="Remove item"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between p-4 pb-2">
            <CardTitle className="text-base font-semibold">Deadlines</CardTitle>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setDeadlines((d) => [...d, { label: "New deadline", type: "other" }])}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </CardHeader>
          <CardContent className="p-4 pt-2 space-y-2">
            {deadlines.map((d, idx) => (
              <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-1.5 items-end border rounded-md p-1.5">
                <div className="md:col-span-5 space-y-0.5">
                  <Label className="text-xs">Label</Label>
                  <Input
                    className="h-9"
                    value={d.label}
                    onChange={(e) => {
                      const next = [...deadlines];
                      next[idx] = { ...d, label: e.target.value };
                      setDeadlines(next);
                    }}
                  />
                </div>
                <div className="md:col-span-3 space-y-0.5">
                  <Label className="text-xs">Date</Label>
                  <Input
                    className="h-9"
                    type="date"
                    value={d.date?.slice(0, 10) ?? ""}
                    onChange={(e) => {
                      const next = [...deadlines];
                      next[idx] = { ...d, date: e.target.value || undefined };
                      setDeadlines(next);
                    }}
                  />
                </div>
                <div className="md:col-span-3 space-y-0.5">
                  <Label className="text-xs">Type</Label>
                  <Select
                    value={d.type ?? "other"}
                    onValueChange={(v) => {
                      const next = [...deadlines];
                      next[idx] = { ...d, type: v as AdmissionDeadline["type"] };
                      setDeadlines(next);
                    }}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admission">Admission</SelectItem>
                      <SelectItem value="scholarship">Scholarship</SelectItem>
                      <SelectItem value="document">Document</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="md:col-span-1"
                  onClick={() => setDeadlines((x) => x.filter((_, i) => i !== idx))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between p-4 pb-2">
            <CardTitle className="text-base font-semibold">Contacts</CardTitle>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setContacts((c) => [...c, { role: "Admissions", email: "", name: "" }])}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </CardHeader>
          <CardContent className="p-4 pt-2 space-y-2">
            {contacts.map((c, idx) => (
              <div key={idx} className="grid gap-1.5 md:grid-cols-12 border rounded-md p-1.5">
                <div className="md:col-span-3 space-y-0.5">
                  <Label className="text-xs">Role</Label>
                  <Input
                    className="h-9"
                    value={c.role}
                    onChange={(e) => {
                      const next = [...contacts];
                      next[idx] = { ...c, role: e.target.value };
                      setContacts(next);
                    }}
                  />
                </div>
                <div className="md:col-span-3 space-y-0.5">
                  <Label className="text-xs">Name</Label>
                  <Input
                    className="h-9"
                    value={c.name ?? ""}
                    onChange={(e) => {
                      const next = [...contacts];
                      next[idx] = { ...c, name: e.target.value };
                      setContacts(next);
                    }}
                  />
                </div>
                <div className="md:col-span-5 space-y-0.5">
                  <Label className="text-xs">Email</Label>
                  <Input
                    className="h-9"
                    type="email"
                    value={c.email ?? ""}
                    onChange={(e) => {
                      const next = [...contacts];
                      next[idx] = { ...c, email: e.target.value };
                      setContacts(next);
                    }}
                  />
                </div>
                <Button type="button" size="icon" variant="ghost" onClick={() => setContacts((x) => x.filter((_, i) => i !== idx))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Statement of purpose</CardTitle>
            <CardDescription>
              Link an existing SOP or create a new one attached to this application.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <Select value={sopId || "none"} onValueChange={(v) => setSopId(v === "none" ? "" : v)}>
                <SelectTrigger className="sm:min-w-[240px] sm:flex-1">
                  <SelectValue placeholder="No SOP linked" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {sops.map((s) => (
                    <SelectItem key={s._id} value={s._id}>
                      {s.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="secondary" size="sm" className="shrink-0" asChild>
                <Link href={`/sop/new?admissionApplicationId=${encodeURIComponent(id)}`}>
                  <Plus className="h-4 w-4 mr-2" />
                  New SOP for this application
                </Link>
              </Button>
            </div>
            {sopId && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/sop/${sopId}/edit`}>Edit linked SOP</Link>
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-2 space-y-0.5">
            <CardTitle className="text-base font-semibold">Documents</CardTitle>
            <CardDescription className="text-xs">Upload files, then Save to attach them to this application.</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-2 space-y-2">
            <label className="inline-flex items-center gap-2 cursor-pointer text-xs">
              <Upload className="h-3.5 w-3.5" />
              <span>Upload file</span>
              <input type="file" className="hidden" onChange={uploadDoc} />
            </label>
            <ul className="text-xs space-y-1">
              {attachmentIds.map((aid) => (
                <li key={aid} className="flex items-center justify-between gap-2 border rounded px-2 py-0.5">
                  <span>{attachmentMeta.get(aid)?.filename ?? aid}</span>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setAttachmentIds((x) => x.filter((i) => i !== aid))}>
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Send email</DialogTitle>
            <DialogDescription>Uses your configured SMTP. Add attachments from this application.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-1">
            <div className="flex flex-wrap gap-1.5">
              <Button type="button" size="sm" variant="outline" onClick={() => openEmailComposer("admissions")}>
                Preset: admissions
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => openEmailComposer("scholarship")}>
                Preset: scholarship
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => openEmailComposer("prof")}>
                Preset: faculty
              </Button>
            </div>
            <div className="space-y-0.5">
              <Label className="text-xs">To</Label>
              <Input className="h-9" value={emailTo} onChange={(e) => setEmailTo(e.target.value)} />
            </div>
            <div className="space-y-0.5">
              <Label className="text-xs">Subject</Label>
              <Input className="h-9" value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} />
            </div>
            <div className="space-y-0.5">
              <Label className="text-xs">Body</Label>
              <Textarea
                className="min-h-[200px] resize-y text-sm py-2"
                rows={8}
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
              />
            </div>
            {attachmentIds.length > 0 && (
              <div className="space-y-1">
                <Label className="text-xs">Attach from application</Label>
                <div className="space-y-0.5 max-h-28 overflow-y-auto border rounded p-1.5 text-xs">
                  {attachmentIds.map((aid) => (
                    <label key={aid} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={emailAttachIds.includes(aid)}
                        onCheckedChange={(checked) => {
                          setEmailAttachIds((prev) =>
                            checked ? [...prev, aid] : prev.filter((x) => x !== aid)
                          );
                        }}
                      />
                      {attachmentMeta.get(aid)?.filename ?? aid}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailOpen(false)}>
              Cancel
            </Button>
            <Button onClick={sendEmail} disabled={emailSending}>
              {emailSending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
