import type { AdmissionChecklistItem, AdmissionStage } from "@/lib/types/admission";
import { ADMISSION_STAGES } from "@/lib/types/admission";

export function admissionChecklistProgress(checklist: AdmissionChecklistItem[]): number {
  if (!checklist.length) return 0;
  const totalWeight = checklist.reduce((s, i) => s + (i.weight ?? 1), 0);
  const doneWeight = checklist
    .filter((i) => i.done)
    .reduce((s, i) => s + (i.weight ?? 1), 0);
  return Math.round((doneWeight / totalWeight) * 100);
}

const STAGE_LABELS: Record<AdmissionStage, string> = {
  researching: "Researching",
  in_progress: "In progress",
  ready_to_submit: "Ready to submit",
  submitted: "Submitted",
  under_review: "Under review",
  interview: "Interview",
  decision: "Decision",
  scholarship: "Scholarship",
  archived: "Archived",
};

export function admissionStageLabel(stage: AdmissionStage): string {
  return STAGE_LABELS[stage] ?? stage;
}

export function admissionStagesOrdered(): readonly AdmissionStage[] {
  return ADMISSION_STAGES;
}

export function newChecklistItemId(): string {
  return `cl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}
