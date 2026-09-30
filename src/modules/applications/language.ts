import type { OutputLanguage } from "./schemas";

const SERBIAN_WORDS =
  /\b(i|za|je|u|sa|na|od|da|se|posao|rad|radno|iskustvo|uslovi|obaveze|nudimo|kandidat|poslodavac|zaposlenje|prijava|mesto|plata|firma)\b/gi;
const ENGLISH_WORDS =
  /\b(the|and|for|with|you|your|we|our|experience|requirements|responsibilities|apply|role|team|job)\b/gi;

/** Serbian (Latin or Cyrillic) vs English, from the posting text. */
export function detectPostingLanguage(text: string): OutputLanguage {
  const sample = text.slice(0, 4000);
  if (/[Ѐ-ӿ]{20,}/.test(sample)) return "sr";
  const diacritics = (sample.match(/[čćšžđČĆŠŽĐ]/g) ?? []).length;
  const serbian = (sample.match(SERBIAN_WORDS) ?? []).length + diacritics;
  const english = (sample.match(ENGLISH_WORDS) ?? []).length;
  return serbian > english * 1.2 && serbian >= 5 ? "sr" : "en";
}

/** Instruction appended to CV / letter prompts. */
export function languageInstruction(language: OutputLanguage): string {
  return language === "sr"
    ? "Write every text field in Serbian, Latin script (latinica), standard ekavian. Keep company names, product names and tool names as written."
    : "Write in English.";
}
