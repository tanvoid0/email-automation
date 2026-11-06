"use client";

import { PageHeader } from "@/app/components/PageHeader";
import { AdmissionSettingsCard } from "@/components/settings/AdmissionSettingsCard";

export default function AdmissionsSettingsPage() {
  return (
    <div className="mx-auto max-w-xl space-y-6 p-4 md:p-8">
      <PageHeader
        title="Admission settings"
        description="Same defaults as in global Settings — edit here or under Settings → Admissions defaults."
        backHref="/admissions"
        backLabel="Back to applications"
      />
      <AdmissionSettingsCard
        alternateSettingsHref="/settings"
        alternateSettingsLabel="Open global Settings"
      />
    </div>
  );
}
