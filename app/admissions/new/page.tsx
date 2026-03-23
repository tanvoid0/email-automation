"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/lib/hooks/useToast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Loader2, Save, Sparkles } from "lucide-react";
import type { AdmissionChecklistItem, AdmissionDeadline } from "@/lib/types/admission";
import { ADMISSION_STAGES } from "@/lib/types/admission";
import { admissionStageLabel } from "@/lib/utils/admissions";
import type { AdmissionExtractResult } from "@/lib/validations/admissionExtract";

function safeUrlInput(u: string | null | undefined): string {
  if (!u?.trim()) return "";
  try {
    new URL(u.trim());
    return u.trim();
  } catch {
    return "";
  }
}

function newChecklistId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `chk-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function NewAdmissionPage() {
  const toast = useToast();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(true);

  const [primaryUrl, setPrimaryUrl] = useState("");
  const [contextSubject, setContextSubject] = useState("");
  const [admissionLevelCtx, setAdmissionLevelCtx] = useState("");
  const [admissionSubjectAreaCtx, setAdmissionSubjectAreaCtx] = useState("");
  const [extractNotice, setExtractNotice] = useState<{ disclaimer: string; confidenceNote: string } | null>(null);

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
  const [notes, setNotes] = useState("");
  const [checklist, setChecklist] = useState<AdmissionChecklistItem[]>([]);
  const [deadlines, setDeadlines] = useState<AdmissionDeadline[]>([]);
  const [payLabel, setPayLabel] = useState("Application fee");
  const [payAmountText, setPayAmountText] = useState("");
  const [payAmountValue, setPayAmountValue] = useState("");
  const [payCurrency, setPayCurrency] = useState("");
  const [payUrl, setPayUrl] = useState("");
  const [payNote, setPayNote] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/settings/admissions");
        if (!res.ok) throw new Error("load");
        const data = await res.json();
        if (cancelled) return;
        setAdmissionLevelCtx(data.admissionLevel ?? "");
        setAdmissionSubjectAreaCtx(data.admissionSubjectArea ?? "");
      } catch {
        if (!cancelled) toast.error("Could not load admission defaults — you can still type them below");
      } finally {
        if (!cancelled) setSettingsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [toast]);

  const applyExtractResult = (data: AdmissionExtractResult) => {
    setUniversityName(data.universityName);
    setProgramName(data.programName?.trim() ?? "");
    setDegree(data.degree?.trim() ?? "");
    setCountry(data.country?.trim() ?? "");
    setTerm(data.term?.trim() ?? "");
    setApplicationUrl(safeUrlInput(data.applicationUrl) || safeUrlInput(primaryUrl));
    setScholarshipUrl(safeUrlInput(data.scholarshipUrl));
    setDepartmentUrl(safeUrlInput(data.departmentUrl));
    setStatusPortalUrl(safeUrlInput(data.statusPortalUrl));

    const dl: AdmissionDeadline[] = (data.deadlines ?? []).map((d) => ({
      label: d.label,
      date: d.dateISO?.trim() || d.dateText?.trim() || undefined,
      type: d.type,
    }));
    setDeadlines(dl);

    const cl: AdmissionChecklistItem[] = (data.checklistLabels ?? []).map((label) => ({
      id: newChecklistId(),
      label,
      done: false,
    }));
    setChecklist(cl);

    const sp = data.suggestedPayment;
    if (sp) {
      setPayLabel((sp.label ?? "").trim() || "Application fee");
      setPayAmountText(sp.amountText?.trim() ?? "");
      setPayAmountValue(
        sp.amountValue != null && Number.isFinite(sp.amountValue) ? String(sp.amountValue) : ""
      );
      setPayCurrency(sp.currency?.trim() ?? "");
      setPayUrl(safeUrlInput(sp.paymentUrl));
      setPayNote(sp.note?.trim() ?? "");
    }

    const noteParts = [data.notes?.trim(), data.disclaimer?.trim(), data.confidenceNote?.trim()].filter(
      Boolean
    ) as string[];
    if (noteParts.length > 0) {
      setNotes((prev) => {
        const p = prev.trim();
        const block = noteParts.join("\n\n");
        return p ? `${p}\n\n${block}` : block;
      });
    }

    setExtractNotice({
      disclaimer: data.disclaimer,
      confidenceNote: data.confidenceNote,
    });
  };

  const handleExtract = async () => {
    const url = primaryUrl.trim();
    if (!url) {
      toast.error("Paste the official program or application page URL");
      return;
    }
    try {
      new URL(url);
    } catch {
      toast.error("Enter a valid URL (including https://)");
      return;
    }

    setExtracting(true);
    setExtractNotice(null);
    try {
      const res = await fetch("/api/admissions/extract-from-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          primaryUrl: url,
          contextSubject: contextSubject.trim() || undefined,
          admissionLevel: admissionLevelCtx.trim() || undefined,
          admissionSubjectArea: admissionSubjectAreaCtx.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Extract failed");
      }
      applyExtractResult(data as AdmissionExtractResult);
      toast.success("Fields filled from the page — verify everything against the official site");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Extract failed");
    } finally {
      setExtracting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!universityName.trim()) {
      toast.error("University name is required");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admissions", {
        method: "POST",
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
          notes: notes.trim() || undefined,
          checklist,
          deadlines,
          contacts: [],
          attachments: [],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create");
      }
      const newId = data._id as string;
      const payNum =
        payAmountValue.trim() === ""
          ? undefined
          : Number.parseFloat(payAmountValue.replace(",", "."));
      const hasPaymentDraft =
        payAmountText.trim() ||
        payCurrency.trim() ||
        payUrl.trim() ||
        payNote.trim() ||
        (payNum != null && Number.isFinite(payNum));
      if (hasPaymentDraft) {
        const pr = await fetch(`/api/admissions/${newId}/payments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label: payLabel.trim() || "Application fee",
            amountText: payAmountText.trim() || undefined,
            amountValue: payNum != null && Number.isFinite(payNum) ? payNum : undefined,
            currency: payCurrency.trim() || undefined,
            paymentUrl: payUrl.trim() || undefined,
            note: payNote.trim() || undefined,
            status: "pending",
          }),
        });
        if (!pr.ok) {
          const err = await pr.json();
          toast.error(err.error || "Saved application, but creating the payment row failed");
        }
      }
      toast.success("Application created");
      router.push(`/admissions/${newId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-2xl mx-auto space-y-4">
        <Link
          href="/admissions"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to applications
        </Link>

        <Card className="border-primary/20">
          <CardHeader className="p-4 pb-2 space-y-1">
            <CardTitle className="text-base font-semibold">Quick start</CardTitle>
            <CardDescription className="text-xs leading-relaxed">
              Paste a program or application page URL, add a short subject line, then run AI extract. Level and
              discipline defaults come from{" "}
              <Link href="/admissions/settings" className="text-primary underline">
                admission settings
              </Link>
              ; override below for this run only.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-2 space-y-3">
            <div className="space-y-1">
              <Label className="text-xs" htmlFor="primaryUrl">
                Page URL *
              </Label>
              <Input
                className="h-9"
                id="primaryUrl"
                type="url"
                value={primaryUrl}
                onChange={(e) => setPrimaryUrl(e.target.value)}
                placeholder="https://…"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs" htmlFor="ctxSubject">
                Subject / focus
              </Label>
              <Input
                className="h-9"
                id="ctxSubject"
                value={contextSubject}
                onChange={(e) => setContextSubject(e.target.value)}
                placeholder='e.g. MS Robotics, Fall 2027'
              />
              <p className="text-[11px] text-muted-foreground leading-snug">
                Helps when the page is sparse or generic (e.g. central graduate admissions).
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs" htmlFor="lvl">
                  Admission level (AI)
                </Label>
                <Input
                  className="h-9"
                  id="lvl"
                  value={admissionLevelCtx}
                  onChange={(e) => setAdmissionLevelCtx(e.target.value)}
                  disabled={settingsLoading}
                  placeholder="Graduate / Undergraduate"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs" htmlFor="subj">
                  Discipline (AI)
                </Label>
                <Input
                  className="h-9"
                  id="subj"
                  value={admissionSubjectAreaCtx}
                  onChange={(e) => setAdmissionSubjectAreaCtx(e.target.value)}
                  disabled={settingsLoading}
                  placeholder="Field of study"
                />
              </div>
            </div>
            <Button type="button" onClick={handleExtract} disabled={extracting || settingsLoading} className="w-full">
              {extracting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Extracting…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Extract & fill form
                </>
              )}
            </Button>
            {extractNotice && (
              <div className="rounded-md border bg-muted/50 p-2.5 text-xs space-y-1.5">
                <p className="font-medium text-foreground">Verify on the official site</p>
                <p className="text-muted-foreground leading-snug">{extractNotice.disclaimer}</p>
                <p className="text-muted-foreground text-[11px] leading-snug">{extractNotice.confidenceNote}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-2 space-y-1">
            <CardTitle className="text-base font-semibold">Application details</CardTitle>
            <CardDescription className="text-xs leading-relaxed">
              Review before creating. Extract fills checklist and deadlines.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs" htmlFor="uni">
                  University *
                </Label>
                <Input
                  className="h-9"
                  id="uni"
                  value={universityName}
                  onChange={(e) => setUniversityName(e.target.value)}
                  placeholder="e.g. Stanford University"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs" htmlFor="prog">
                  Program
                </Label>
                <Input
                  className="h-9"
                  id="prog"
                  value={programName}
                  onChange={(e) => setProgramName(e.target.value)}
                  placeholder="e.g. MS Computer Science"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs" htmlFor="deg">
                    Degree
                  </Label>
                  <Input
                    className="h-9"
                    id="deg"
                    value={degree}
                    onChange={(e) => setDegree(e.target.value)}
                    placeholder="MS / PhD / BA"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs" htmlFor="term">
                    Intake term
                  </Label>
                  <Input
                    className="h-9"
                    id="term"
                    value={term}
                    onChange={(e) => setTerm(e.target.value)}
                    placeholder="Fall 2026"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs" htmlFor="country">
                  Country
                </Label>
                <Input
                  className="h-9"
                  id="country"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="United States"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs" htmlFor="appUrl">
                  Application URL
                </Label>
                <Input
                  className="h-9"
                  id="appUrl"
                  type="url"
                  value={applicationUrl}
                  onChange={(e) => setApplicationUrl(e.target.value)}
                  placeholder="https://..."
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs" htmlFor="schUrl">
                  Scholarship / aid URL
                </Label>
                <Input
                  className="h-9"
                  id="schUrl"
                  type="url"
                  value={scholarshipUrl}
                  onChange={(e) => setScholarshipUrl(e.target.value)}
                  placeholder="https://..."
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs" htmlFor="deptUrl">
                  Department page
                </Label>
                <Input
                  className="h-9"
                  id="deptUrl"
                  type="url"
                  value={departmentUrl}
                  onChange={(e) => setDepartmentUrl(e.target.value)}
                  placeholder="https://..."
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs" htmlFor="portalUrl">
                  Status portal
                </Label>
                <Input
                  className="h-9"
                  id="portalUrl"
                  type="url"
                  value={statusPortalUrl}
                  onChange={(e) => setStatusPortalUrl(e.target.value)}
                  placeholder="https://..."
                />
              </div>
              <div className="rounded-md border bg-muted/20 p-3 space-y-2">
                <p className="text-xs font-medium">First payment (optional)</p>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Saved as a separate payment record; add more on the detail page. Extract may fill via suggestedPayment.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs" htmlFor="payLabel">
                      Label
                    </Label>
                    <Input
                      className="h-9"
                      id="payLabel"
                      value={payLabel}
                      onChange={(e) => setPayLabel(e.target.value)}
                      placeholder="Application fee"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs" htmlFor="payAmt">
                      Amount (text)
                    </Label>
                    <Input
                      className="h-9"
                      id="payAmt"
                      value={payAmountText}
                      onChange={(e) => setPayAmountText(e.target.value)}
                      placeholder="e.g. 85 or $125"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs" htmlFor="payAmtNum">
                      Amount (numeric)
                    </Label>
                    <Input
                      className="h-9"
                      id="payAmtNum"
                      type="number"
                      step="any"
                      value={payAmountValue}
                      onChange={(e) => setPayAmountValue(e.target.value)}
                      placeholder="Optional"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs" htmlFor="payCur">
                      Currency
                    </Label>
                    <Input
                      className="h-9"
                      id="payCur"
                      value={payCurrency}
                      onChange={(e) => setPayCurrency(e.target.value)}
                      placeholder="USD"
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs" htmlFor="payUrl">
                      Payment URL
                    </Label>
                    <Input
                      className="h-9"
                      id="payUrl"
                      type="url"
                      value={payUrl}
                      onChange={(e) => setPayUrl(e.target.value)}
                      placeholder="https://…"
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs" htmlFor="payNote">
                      Note
                    </Label>
                    <Textarea
                      className="min-h-[52px] resize-y text-sm py-2"
                      id="payNote"
                      value={payNote}
                      onChange={(e) => setPayNote(e.target.value)}
                      rows={2}
                      placeholder="Optional"
                    />
                  </div>
                </div>
              </div>
              {(deadlines.length > 0 || checklist.length > 0) && (
                <div className="rounded-md border p-2.5 space-y-2 text-xs">
                  {deadlines.length > 0 && (
                    <div>
                      <p className="font-medium mb-1">Deadlines ({deadlines.length})</p>
                      <ul className="list-disc list-inside text-muted-foreground space-y-1">
                        {deadlines.map((d, i) => (
                          <li key={`${d.label}-${i}`}>
                            {d.label}
                            {d.date ? ` — ${d.date}` : ""}
                            {d.type ? ` (${d.type})` : ""}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {checklist.length > 0 && (
                    <div>
                      <p className="font-medium mb-1">Checklist ({checklist.length})</p>
                      <ul className="list-disc list-inside text-muted-foreground space-y-1">
                        {checklist.map((c) => (
                          <li key={c.id}>{c.label}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
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
              </div>
              <div className="space-y-1">
                <Label className="text-xs" htmlFor="notes">
                  Notes
                </Label>
                <Textarea
                  className="min-h-[88px] resize-y text-sm py-2"
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="GRE codes, recommender notes, AI disclaimers, etc."
                />
              </div>
              <Button type="submit" disabled={submitting} className="w-full">
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Create & continue
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
