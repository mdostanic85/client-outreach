/** Client-safe Gmail compose helper (no DB / Node imports). */
export function gmailComposeUrl(subject: string, body: string, to?: string | null) {
  const params = new URLSearchParams();
  if (to) params.set("to", to);
  params.set("su", subject);
  params.set("body", body);
  return `https://mail.google.com/mail/?view=cm&fs=1&${params.toString()}`;
}
