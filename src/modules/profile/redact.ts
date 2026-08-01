/**
 * Strip common PII before sending profile text to a public model fallback.
 * Private (Anthropic) path receives original text.
 */
export function redactPii(text: string): string {
  let out = text;
  // Emails
  out = out.replace(
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    "[REDACTED_EMAIL]",
  );
  // Phone numbers (intl / local-ish)
  out = out.replace(
    /(?:\+|00)?\d{1,3}[\s.-]?(?:\(?\d{2,4}\)?[\s.-]?)?\d{3,4}[\s.-]?\d{3,4}/g,
    "[REDACTED_PHONE]",
  );
  // Postal / street-ish lines (conservative)
  out = out.replace(
    /\b\d{1,5}\s+[A-Za-z][A-Za-z\s.-]{2,40}\b(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr)\b/gi,
    "[REDACTED_ADDRESS]",
  );
  // DOB-ish dates labeled
  out = out.replace(
    /\b(?:DOB|Date of birth|Born)\s*[:\-]?\s*\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}/gi,
    "[REDACTED_DOB]",
  );
  // National ID-ish long digit runs (8+)
  out = out.replace(/\b\d{9,14}\b/g, "[REDACTED_ID]");
  return out;
}
