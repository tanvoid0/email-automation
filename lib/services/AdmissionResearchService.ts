import { generateAIResponseRaw } from "@/lib/gemini";
import {
  admissionResearchResultSchema,
  type AdmissionResearchRequest,
  type AdmissionResearchResult,
} from "@/lib/validations/admissionResearch";

const URL_FETCH_TIMEOUT_MS = 8000;
const MAX_URL_BYTES = 500_000;

/** Block obvious SSRF targets (localhost, private IPs, link-local). Does not replace network egress controls. */
function isBlockedFetchHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost") return true;
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (v4) {
    const a = Number(v4[1]);
    const b = Number(v4[2]);
    const c = Number(v4[3]);
    const d = Number(v4[4]);
    if ([a, b, c, d].some((n) => n > 255)) return true;
    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    return false;
  }
  if (h.includes(":")) {
    if (h === "::1") return true;
    if (h.startsWith("fe80:")) return true;
    // IPv6 unique local (fc00::/7)
    if (/^f[cd][0-9a-f]{2}:/i.test(h)) return true;
  }
  return false;
}

export async function fetchUrlPlainText(url: string): Promise<{ url: string; text: string; error?: string }> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { url, text: "", error: "Invalid URL" };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { url, text: "", error: "Only http(s) URLs are allowed" };
  }
  if (isBlockedFetchHost(parsed.hostname)) {
    return { url, text: "", error: "URL host is not allowed" };
  }

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), URL_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "AdmitDeskResearch/1.0 (student admissions assistant)",
        Accept: "text/html,text/plain;q=0.9,*/*;q=0.8",
      },
      redirect: "follow",
    });
    if (!res.ok) {
      return { url, text: "", error: `HTTP ${res.status}` };
    }
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_URL_BYTES) {
      return { url, text: "", error: "Page too large" };
    }
    const raw = new TextDecoder("utf-8", { fatal: false }).decode(buf);
    const text = raw
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80_000);
    return { url, text };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch failed";
    return { url, text: "", error: msg };
  } finally {
    clearTimeout(t);
  }
}

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

function buildPrompt(
  input: AdmissionResearchRequest,
  urlContexts: { url: string; text: string; error?: string }[]
): string {
  const ctx =
    urlContexts.length === 0
      ? "No official page text was supplied; use general knowledge and clearly mark uncertainty."
      : urlContexts
          .map((u) => {
            if (u.error) {
              return `URL ${u.url}: could not fetch (${u.error}).`;
            }
            return `URL ${u.url} (plain text excerpt):\n${u.text.slice(0, 25_000)}`;
          })
          .join("\n\n---\n\n");

  return `You are assisting a university applicant. Output ONLY valid JSON (no markdown outside JSON) matching this TypeScript shape:
{
  "officialLinks": { "label": string, "url": string, "kind"?: string }[],
  "deadlines": { "label": string, "dateISO"?: string | null, "dateText": string, "category": "admission"|"scholarship"|"document"|"other", "notes"?: string | null }[],
  "fees": { "description": string, "amountText"?: string | null, "currency"?: string | null, "notes"?: string | null }[],
  "requirements": string[],
  "processSteps": string[],
  "scholarships": { "name": string, "url"?: string | null, "eligibilitySummary"?: string | null, "deadlineText"?: string | null }[],
  "confidenceNote": string,
  "disclaimer": string,
  "usedGrounding": false
}

Rules:
- Prefer information from the supplied page excerpts when present; otherwise say you are inferring.
- Never invent specific calendar dates; if unsure use dateText like "check official site" and omit or null dateISO.
- officialLinks: use real https URLs when known; otherwise omit questionable links.
- disclaimer must warn that deadlines, fees, and requirements change and MUST be verified on official university pages.
- focus: ${input.focus}
- University: ${input.universityName}
- Program: ${input.programName ?? "not specified"}
- Degree: ${input.degree ?? "not specified"}
- Country: ${input.country ?? "not specified"}
- Intake term: ${input.term ?? "not specified"}

Context:
${ctx}`;
}

export class AdmissionResearchService {
  static async research(input: AdmissionResearchRequest): Promise<AdmissionResearchResult> {
    const urlContexts = await Promise.all(
      (input.optionalUrls ?? []).map((u) => fetchUrlPlainText(u))
    );

    const prompt = buildPrompt(input, urlContexts);
    const { text } = await generateAIResponseRaw({ prompt });
    const jsonStr = extractJsonObject(text);
    if (!jsonStr) {
      throw new Error("AI did not return parseable JSON");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      const fixPrompt = `The following text should be a single JSON object but may be invalid. Fix it to valid JSON only, no commentary:\n${jsonStr.slice(0, 120_000)}`;
      const { text: fixed } = await generateAIResponseRaw({ prompt: fixPrompt });
      const fixedJson = extractJsonObject(fixed) ?? fixed.trim();
      parsed = JSON.parse(fixedJson);
    }

    const validated = admissionResearchResultSchema.safeParse(parsed);
    if (!validated.success) {
      throw new Error(`AI JSON failed validation: ${validated.error.message}`);
    }
    return validated.data;
  }
}
