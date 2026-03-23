"use client";

import { useEffect, useState } from "react";
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
import { Loader2, Plus, Save, Trash2, Wallet } from "lucide-react";
import type { AdmissionPaymentRecord, AdmissionPaymentStatus } from "@/lib/types/admissionPayment";
import { ADMISSION_PAYMENT_STATUSES } from "@/lib/types/admissionPayment";
import type { AdmissionStage } from "@/lib/types/admission";
import {
  admissionPaymentStatusLabel,
  admissionPaymentsNeedAttention,
} from "@/lib/utils/admission-payments";
import { useToast } from "@/lib/hooks/useToast";

function PaymentRow({
  admissionId,
  payment,
  onUpdated,
}: {
  admissionId: string;
  payment: AdmissionPaymentRecord;
  onUpdated: () => void;
}) {
  const toast = useToast();
  const [label, setLabel] = useState(payment.label);
  const [amountText, setAmountText] = useState(payment.amountText ?? "");
  const [amountValue, setAmountValue] = useState(
    payment.amountValue != null ? String(payment.amountValue) : ""
  );
  const [currency, setCurrency] = useState(payment.currency ?? "");
  const [paymentUrl, setPaymentUrl] = useState(payment.paymentUrl ?? "");
  const [note, setNote] = useState(payment.note ?? "");
  const [status, setStatus] = useState<AdmissionPaymentStatus>(payment.status);
  const [paidAt, setPaidAt] = useState(payment.paidAt?.slice(0, 10) ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setLabel(payment.label);
    setAmountText(payment.amountText ?? "");
    setAmountValue(payment.amountValue != null ? String(payment.amountValue) : "");
    setCurrency(payment.currency ?? "");
    setPaymentUrl(payment.paymentUrl ?? "");
    setNote(payment.note ?? "");
    setStatus(payment.status);
    setPaidAt(payment.paidAt?.slice(0, 10) ?? "");
  }, [payment]);

  const saveRow = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admissions/${admissionId}/payments/${payment._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: label.trim() || "Application fee",
          amountText: amountText.trim() || undefined,
          amountValue: (() => {
            if (!amountValue.trim()) return undefined;
            const v = Number.parseFloat(amountValue.replace(",", "."));
            return Number.isFinite(v) ? v : undefined;
          })(),
          currency: currency.trim() || undefined,
          paymentUrl: paymentUrl.trim() || undefined,
          note: note.trim() || undefined,
          status,
          paidAt: status === "paid" ? paidAt.trim() || undefined : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      toast.success("Payment updated");
      onUpdated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const removeRow = async () => {
    if (!confirm("Remove this payment record?")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admissions/${admissionId}/payments/${payment._id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Delete failed");
      }
      toast.success("Removed");
      onUpdated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="rounded-md border p-3 space-y-2 bg-muted/20">
      <div className="grid gap-2 md:grid-cols-2">
        <div className="space-y-1 md:col-span-2">
          <Label className="text-xs">Label</Label>
          <Input
            className="h-9"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Application fee"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Amount (text)</Label>
          <Input
            className="h-9"
            value={amountText}
            onChange={(e) => setAmountText(e.target.value)}
            placeholder="e.g. 85 or $125"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Amount (numeric)</Label>
          <Input
            className="h-9"
            type="number"
            step="any"
            value={amountValue}
            onChange={(e) => setAmountValue(e.target.value)}
            placeholder="Optional"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Currency</Label>
          <Input className="h-9" value={currency} onChange={(e) => setCurrency(e.target.value)} placeholder="USD" />
        </div>
        <div className="space-y-1 md:col-span-2">
          <Label className="text-xs">Payment URL</Label>
          <Input className="h-9" type="url" value={paymentUrl} onChange={(e) => setPaymentUrl(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as AdmissionPaymentStatus)}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ADMISSION_PAYMENT_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {admissionPaymentStatusLabel(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Paid on</Label>
          <Input
            className="h-9"
            type="date"
            value={paidAt}
            onChange={(e) => setPaidAt(e.target.value)}
            disabled={status !== "paid"}
          />
        </div>
        <div className="space-y-1 md:col-span-2">
          <Label className="text-xs">Note</Label>
          <Textarea
            className="min-h-[52px] resize-y text-sm py-2"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Receipt #, etc."
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 pt-0.5">
        <Button type="button" size="sm" onClick={saveRow} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
          Save
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={removeRow} disabled={deleting}>
          <Trash2 className="h-4 w-4 mr-1" />
          Remove
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => {
            setStatus("paid");
            setPaidAt(new Date().toISOString().slice(0, 10));
          }}
        >
          Mark paid today
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            setStatus("waived");
            setPaidAt("");
          }}
        >
          Waived
        </Button>
      </div>
    </div>
  );
}

export function AdmissionPaymentsSection({
  admissionId,
  stage,
  payments,
  onReload,
}: {
  admissionId: string;
  stage: AdmissionStage;
  payments: AdmissionPaymentRecord[];
  onReload: () => void;
}) {
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const [nLabel, setNLabel] = useState("Application fee");
  const [nAmountText, setNAmountText] = useState("");
  const [nCurrency, setNCurrency] = useState("");
  const [nUrl, setNUrl] = useState("");
  const [nNote, setNNote] = useState("");

  const createPayment = async () => {
    setCreating(true);
    try {
      const res = await fetch(`/api/admissions/${admissionId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: nLabel.trim() || "Application fee",
          amountText: nAmountText.trim() || undefined,
          currency: nCurrency.trim() || undefined,
          paymentUrl: nUrl.trim() || undefined,
          note: nNote.trim() || undefined,
          status: "pending",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Create failed");
      toast.success("Payment added");
      setNAmountText("");
      setNCurrency("");
      setNUrl("");
      setNNote("");
      setNLabel("Application fee");
      onReload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Create failed");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Card>
      <CardHeader className="p-4 pb-2 space-y-1">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Wallet className="h-4 w-4 shrink-0" />
          Payments &amp; fees
        </CardTitle>
        <CardDescription className="text-xs leading-relaxed">
          Separate records for fees, deposits, etc. — amount, currency, URL, notes, status.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 pt-2 space-y-3">
        {admissionPaymentsNeedAttention(
          stage,
          payments.map((p) => ({ status: p.status }))
        ) && (
          <p className="text-xs text-amber-800 dark:text-amber-200 rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 leading-snug">
            At least one payment is still <strong>pending</strong> in an early stage. Pay on the official site, then mark{" "}
            <strong>Paid</strong> on the row.
          </p>
        )}
        {payments.length === 0 ? (
          <p className="text-xs text-muted-foreground">No payment rows yet. Add below or use AI research.</p>
        ) : (
          <div className="space-y-2">
            {payments.map((p) => (
              <PaymentRow key={p._id} admissionId={admissionId} payment={p} onUpdated={onReload} />
            ))}
          </div>
        )}
        <div className="rounded-md border border-dashed p-3 space-y-2">
          <p className="text-xs font-medium flex items-center gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Add payment
          </p>
          <div className="grid gap-2 md:grid-cols-2">
            <div className="space-y-1 md:col-span-2">
              <Label className="text-xs">Label</Label>
              <Input className="h-9" value={nLabel} onChange={(e) => setNLabel(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Amount</Label>
              <Input className="h-9" value={nAmountText} onChange={(e) => setNAmountText(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Currency</Label>
              <Input className="h-9" value={nCurrency} onChange={(e) => setNCurrency(e.target.value)} />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label className="text-xs">Payment URL</Label>
              <Input className="h-9" type="url" value={nUrl} onChange={(e) => setNUrl(e.target.value)} />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label className="text-xs">Note</Label>
              <Textarea
                className="min-h-[52px] resize-y text-sm py-2"
                value={nNote}
                onChange={(e) => setNNote(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <Button type="button" size="sm" onClick={createPayment} disabled={creating}>
            {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Add
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
