"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AdmissionSettingsCard } from "@/components/settings/AdmissionSettingsCard";

export default function AdmissionsSettingsPage() {
  return (
    <main className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-xl mx-auto space-y-6">
        <Link
          href="/admissions"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to applications
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Admission settings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Same defaults as in global Settings — edit here or under Settings → Admissions defaults.
          </p>
        </div>
        <AdmissionSettingsCard
          alternateSettingsHref="/settings"
          alternateSettingsLabel="Open global Settings"
        />
      </div>
    </main>
  );
}
