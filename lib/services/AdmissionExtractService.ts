import { generateAIResponseRaw } from "@/lib/gemini";
import { fetchUrlPlainText } from "@/lib/services/AdmissionResearchService";
import {
  admissionExtractResultSchema,
  type AdmissionExtractRequest,
  type AdmissionExtractResult,
} from "@/lib/validations/admissionExtract";

function extractJsonObject(text: string): string | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    const inner = fenced[1].trim();
    if (inner.startsWith("{")) return inner;
  }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return text.slice(start, end + 1);
  }
  return null;
}

function buildExtractPrompt(
  pageText: string,
  pageError: string | undefined,
  input: AdmissionExtractRequest,
  defaults: { admissionLevel?: string; admissionSubjectArea?: string }
): string {
  const level = input.admissionLevel ?? defaults.admissionLevel ?? "not specified";
  const subjectArea = input.admissionSubjectArea ?? defaults.admissionSubjectArea ?? "not specified";
  const ctxSubject = input.contextSubject ?? "not specified";

  const pageBlock = pageError
    ? `Could not fetch URL (${pageError}). Infer only from context below; set universityName from contextSubject or URL host if possible.`
    : `Page plain text (excerpt):\n${pageText.slice(0, 35_000)}`;

  return `You help a student create an admission tracker row. Output ONLY valid JSON (no markdown fences) with this exact shape:
{
  "universityName": string,
  "programName": string | null,
  "degree": string | null,
  "country": string | null,
  "term": string | null,
  "applicationUrl": string | null,
  "scholarshipUrl": string | null,
  "departmentUrl": string | null,
  "statusPortalUrl": string | null,
  "deadlines": { "label": string, "dateISO": string | null, "dateText": string, "type": "admission"|"scholarship"|"document"|"other", "notes": string | null }[],
  "checklistLabels": string[],
  "notes": string | null,
  "suggestedPayment": { "label": string | null, "amountText": string | null, "amountValue": number | null, "currency": string | null, "paymentUrl": string | null, "note": string | null } | null,
  "confidenceNote": string,
  "disclaimer": string
}

Rules:
- Use the page text when available; otherwise infer cautiously from the student's context.
- admission level (for interpretation): ${level}
- subject / discipline area: ${subjectArea}
- Student's subject line / focus for this application: ${ctxSubject}
- primaryUrl (the page we tried to load): ${input.primaryUrl}
- Prefer setting applicationUrl to the application portal or this URL when appropriate.
- checklistLabels: concrete next steps (e.g. "Submit GRE scores", "Request transcripts") not vague items.
- Do not invent exact calendar dates; use dateText like "see program page" and null dateISO when unsure.
- suggestedPayment: single object if the page states an application/processing fee; otherwise null. Include label (e.g. "Application fee"), amountText, optional amountValue as number if clearly stated, currency, paymentUrl if present, note. Do not guess amounts.
- disclaimer must say official sites are the source of truth.

${pageBlock}`;
}

export class AdmissionExtractService {
  static async extract(
    input: AdmissionExtractRequest,
    defaults: { admissionLevel?: string; admissionSubjectArea?: string }
  ): Promise<AdmissionExtractResult> {
    const { text, error } = await fetchUrlPlainText(input.primaryUrl);
    const prompt = buildExtractPrompt(text, error, input, defaults);
    const { text: raw } = await generateAIResponseRaw({ prompt });
    const jsonStr = extractJsonObject(raw);
    if (!jsonStr) {
      throw new Error("AI did not return parseable JSON");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      const fixPrompt = `Fix to valid JSON only, no commentary:\n${jsonStr.slice(0, 120_000)}`;
      const { text: fixed } = await generateAIResponseRaw({ prompt: fixPrompt });
      const fixedJson = extractJsonObject(fixed) ?? fixed.trim();
      parsed = JSON.parse(fixedJson);
    }

    const validated = admissionExtractResultSchema.safeParse(parsed);
    if (!validated.success) {
      throw new Error(`Extract JSON failed validation: ${validated.error.message}`);
    }
    return validated.data;
  }
}
