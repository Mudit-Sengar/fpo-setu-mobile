import { HI } from "./hi";
import { MR } from "./mr";

export type LangCode = "en" | "hi" | "mr";

export { HI, MR };

const DICTS: Record<Exclude<LangCode, "en">, Record<string, string>> = { hi: HI, mr: MR };

/**
 * Translate a single string. Same semantics as the original web DomTranslator:
 * whitespace-trimmed, case-sensitive lookup; leading/trailing whitespace is
 * preserved; unmatched strings fall through to English.
 */
export function tr(text: string, lang: LangCode): string {
  if (lang === "en") return text;
  const trimmed = text.trim();
  if (trimmed.length === 0) return text;
  const hit = DICTS[lang][trimmed];
  if (!hit) return text;
  const lead = text.match(/^\s*/)?.[0] ?? "";
  const trail = text.match(/\s*$/)?.[0] ?? "";
  return lead + hit + trail;
}
