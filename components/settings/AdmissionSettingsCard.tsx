"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/lib/hooks/useToast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { School, Loader2, Save } from "lucide-react";
import Link from "next/link";

type Props = {
  /** Shown as outline button — e.g. cross-link between global Settings and /admissions/settings */
  alternateSettingsHref?: string;
  alternateSettingsLabel?: string;
};

export function AdmissionSettingsCard({ alternateSettingsHref, alternateSettingsLabel }: Props) {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [admissionLevel, setAdmissionLevel] = useState("");
  const [admissionSubjectArea, setAdmissionSubjectArea] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/settings/admissions");
        if (!res.ok) throw new Error("Failed to load");
        const data = await res.json();
        if (cancelled) return;
        setAdmissionLevel(data.admissionLevel ?? "");
        setAdmissionSubjectArea(data.admissionSubjectArea ?? "");
      } catch {
        if (!cancelled) toast.error("Could not load admission settings");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Intentionally mount-only: avoids refetch loops if `toast` identity ever changes again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/settings/admissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          admissionLevel,
          admissionSubjectArea,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setAdmissionLevel(data.admissionLevel ?? "");
      setAdmissionSubjectArea(data.admissionSubjectArea ?? "");
      toast.success("Admission defaults saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <School className="h-5 w-5 text-primary" />
          <CardTitle>Admissions defaults</CardTitle>
        </div>
        <CardDescription>
          Used as context when you use “extract from URL” on a new application. Official program pages remain the
          source of truth — these values only steer the AI.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="adm-level">Admission level</Label>
              <Input
                id="adm-level"
                value={admissionLevel}
                onChange={(e) => setAdmissionLevel(e.target.value)}
                placeholder='e.g. Graduate (Master’s / PhD), Undergraduate'
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="adm-subject">Subject / discipline area</Label>
              <Input
                id="adm-subject"
                value={admissionSubjectArea}
                onChange={(e) => setAdmissionSubjectArea(e.target.value)}
                placeholder="e.g. Computer Science, Mechanical Engineering"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save defaults
                  </>
                )}
              </Button>
              {alternateSettingsHref && alternateSettingsLabel ? (
                <Button type="button" variant="outline" size="default" asChild>
                  <Link href={alternateSettingsHref}>{alternateSettingsLabel}</Link>
                </Button>
              ) : null}
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
