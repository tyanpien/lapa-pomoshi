const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function formatAuthCredential(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (EMAIL_REGEX.test(trimmed)) return trimmed.toLowerCase();
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length >= 10) {
    if (digits.length === 11 && digits.startsWith("8")) {
      return `+7${digits.slice(1)}`;
    }
    if (digits.length === 11 && digits.startsWith("7")) {
      return `+${digits}`;
    }
    if (digits.length === 10) {
      return `+7${digits}`;
    }
    return `+${digits}`;
  }
  return trimmed.replace(/\s+/g, "");
}

export function isLikelyAuthContact(raw: string): boolean {
  const s = raw.trim();
  if (!s) return false;
  if (EMAIL_REGEX.test(s)) return true;
  const digits = s.replace(/\D/g, "");
  return digits.length >= 10;
}

export function authHintKey(raw: string): string {
  return formatAuthCredential(raw).toLowerCase();
}
