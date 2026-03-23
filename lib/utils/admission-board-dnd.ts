import { arrayMove } from "@dnd-kit/sortable";
import type { AdmissionApiResponse } from "@/lib/types/admission";
import type { AdmissionStage } from "@/lib/types/admission";
import { ADMISSION_STAGES } from "@/lib/types/admission";

export function buildItemsByStage(rows: AdmissionApiResponse[]): Record<AdmissionStage, string[]> {
  const m = {} as Record<AdmissionStage, string[]>;
  for (const s of ADMISSION_STAGES) {
    m[s] = rows
      .filter((a) => a.stage === s)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map((a) => a._id);
  }
  return m;
}

export type AdmissionReorderPatch = { id: string; stage: AdmissionStage; sortOrder: number };

/**
 * Kanban / single-stage list: compute next rows and PATCH payloads after a drag ends.
 * `overId` is another admission id, or `col-${stage}` when dropped on a column (board only).
 */
export function computeAdmissionDragResult(
  rows: AdmissionApiResponse[],
  activeId: string,
  overId: string
): { nextRows: AdmissionApiResponse[]; patches: AdmissionReorderPatch[] } | null {
  if (activeId === overId) return null;

  const activeRow = rows.find((a) => a._id === activeId);
  if (!activeRow) return null;

  const itemsMap = buildItemsByStage(rows);
  const activeStage = activeRow.stage;
  const activeIndex = itemsMap[activeStage].indexOf(activeId);
  if (activeIndex < 0) return null;

  let overStage: AdmissionStage;
  let overIndex: number;

  if (overId.startsWith("col-")) {
    const stage = overId.slice(4) as AdmissionStage;
    if (!ADMISSION_STAGES.includes(stage)) return null;
    overStage = stage;
    overIndex = itemsMap[overStage].length;
  } else {
    const overRow = rows.find((a) => a._id === overId);
    if (!overRow) return null;
    overStage = overRow.stage;
    overIndex = itemsMap[overStage].indexOf(overId);
    if (overIndex < 0) return null;
  }

  const nextMap: Record<AdmissionStage, string[]> = {} as Record<AdmissionStage, string[]>;
  for (const s of ADMISSION_STAGES) {
    nextMap[s] = [...itemsMap[s]];
  }

  if (activeStage === overStage) {
    const list = [...nextMap[activeStage]];
    if (overId.startsWith("col-")) {
      const to = list.length - 1;
      if (activeIndex === to) return null;
      nextMap[activeStage] = arrayMove(list, activeIndex, to);
    } else {
      if (activeIndex === overIndex) return null;
      nextMap[activeStage] = arrayMove(list, activeIndex, overIndex);
    }
  } else {
    nextMap[activeStage] = nextMap[activeStage].filter((id) => id !== activeId);
    const dest = [...nextMap[overStage]];
    const insertAt = overId.startsWith("col-") ? dest.length : overIndex;
    dest.splice(insertAt, 0, activeId);
    nextMap[overStage] = dest;
  }

  const rowById = new Map(rows.map((r) => [r._id, r]));
  const nextRows: AdmissionApiResponse[] = [];
  for (const s of ADMISSION_STAGES) {
    for (let idx = 0; idx < nextMap[s].length; idx++) {
      const id = nextMap[s][idx];
      const r = rowById.get(id);
      if (r) nextRows.push({ ...r, stage: s, sortOrder: idx });
    }
  }

  const patches: AdmissionReorderPatch[] = [];
  for (const r of nextRows) {
    const old = rows.find((x) => x._id === r._id);
    if (old && (old.stage !== r.stage || old.sortOrder !== r.sortOrder)) {
      patches.push({ id: r._id, stage: r.stage, sortOrder: r.sortOrder });
    }
  }

  if (patches.length === 0) return null;

  return { nextRows, patches };
}

export async function persistAdmissionReorderPatches(patches: AdmissionReorderPatch[]): Promise<boolean> {
  const results = await Promise.all(
    patches.map((p) =>
      fetch(`/api/admissions/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: p.stage, sortOrder: p.sortOrder }),
      })
    )
  );
  return results.every((r) => r.ok);
}
