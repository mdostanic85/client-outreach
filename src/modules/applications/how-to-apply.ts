/**
 * Many local postings are applied to by email, phone or a form, not an ATS.
 * Pull those channels out of the posting so the package can show them.
 */
export type HowToApply = {
  emails: string[];
  phones: string[];
  links: string[];
  /** The posting mentions a cover / motivation letter. */
  asksForLetter: boolean;
};

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
/** Serbian and international phone formats: +381 64 123 4567, 064/123-4567, 011 123 45 67. */
const PHONE = /(?:\+\d{2,3}[\s./-]?)?\(?0?\d{2,3}\)?[\s./-]?\d{3,4}[\s./-]?\d{2,4}(?:[\s./-]?\d{2,3})?/g;
const LINK = /https?:\/\/[^\s)<>"']+/g;
const APPLY_CONTEXT = /prijav|apply|aplicir|konkur|cv|biografij|kontakt|contact|pozovite|call|javite/i;

function unique(values: string[]): string[] {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))];
}

function digits(value: string): string {
  return value.replace(/\D/g, "");
}

export function extractHowToApply(description: string, sourceUrl?: string | null): HowToApply {
  const text = description.slice(0, 12000);
  const emails = unique(text.match(EMAIL) ?? []).filter((e) => !/example\.|noreply|no-reply/i.test(e));

  // Phones only near an apply / contact phrase, to skip salaries and dates.
  const phones: string[] = [];
  for (const m of text.matchAll(PHONE)) {
    const around = text.slice(Math.max(0, (m.index ?? 0) - 80), (m.index ?? 0) + m[0].length + 20);
    const d = digits(m[0]);
    if (d.length >= 8 && d.length <= 13 && APPLY_CONTEXT.test(around)) phones.push(m[0].trim());
  }

  const links = unique(text.match(LINK) ?? [])
    .map((l) => l.replace(/[.,;:]+$/, ""))
    .filter((l) => l !== sourceUrl && /apply|prijav|career|karijer|jobs|posao|form/i.test(l));

  return {
    emails: emails.slice(0, 3),
    phones: unique(phones).slice(0, 3),
    links: links.slice(0, 3),
    asksForLetter: /motivaciono pismo|propratno pismo|cover letter|motivation letter|pismo motivacije/i.test(text),
  };
}
