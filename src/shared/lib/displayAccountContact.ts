const SYNTHETIC_EMAIL_RE = /^phone\d+@reg\.paw$/i;

export function displayAccountEmail(email: string | null | undefined): string {
  const e = (email ?? "").trim();
  if (!e || SYNTHETIC_EMAIL_RE.test(e)) return "";
  return e;
}

export function isSyntheticRegEmail(email: string | null | undefined): boolean {
  const e = (email ?? "").trim();
  return Boolean(e) && SYNTHETIC_EMAIL_RE.test(e);
}
