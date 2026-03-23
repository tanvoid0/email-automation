import type { SOPSectionEntry } from "@/lib/types/sop";

/**
 * Merge section contents into a single string (paragraphs separated by double newline).
 */
export function mergeSectionsToContent(sections: SOPSectionEntry[]): string {
  if (!sections || sections.length === 0) return "";
  return sections.map((s) => (s.content || "").trim()).filter(Boolean).join("\n\n");
}

/**
 * Merge a record of section key → content into one string (by ordered keys).
 */
export function mergeSectionRecordToContent(
  sectionContents: Record<string, string>,
  orderedKeys: string[]
): string {
  return orderedKeys
    .map((key) => (sectionContents[key] ?? "").trim())
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Split merged content by paragraphs (double newline) and assign to section keys by order.
 * Extra paragraphs go into the last section; fewer paragraphs leave later sections empty.
 */
export function smartSplitToSections(
  mergedContent: string,
  orderedKeys: string[]
): Record<string, string> {
  const paragraphs = mergedContent
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const result: Record<string, string> = {};
  orderedKeys.forEach((key, i) => {
    result[key] = paragraphs[i] ?? "";
  });
  if (orderedKeys.length > 0 && paragraphs.length > orderedKeys.length) {
    const lastKey = orderedKeys[orderedKeys.length - 1];
    const extra = paragraphs.slice(orderedKeys.length).join("\n\n");
    result[lastKey] = (result[lastKey] || "").trim()
      ? `${result[lastKey].trim()}\n\n${extra}`
      : extra;
  }
  return result;
}
