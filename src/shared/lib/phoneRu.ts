export const PHONE_MASK = "+7 (___) ___-__-__";
export const PHONE_POSITIONS = [4, 5, 6, 9, 10, 11, 13, 14, 16, 17] as const;

export function normalizePhoneDigits(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  const trimmed = raw.trim();
  if (trimmed.startsWith("+7") && digits.startsWith("7")) digits = digits.slice(1);
  if (digits.length === 11 && (digits.startsWith("7") || digits.startsWith("8"))) digits = digits.slice(1);
  if (digits.length > 10) digits = digits.slice(0, 10);
  return digits;
}

export function applyPhoneDigits(digitsRaw: string): string {
  const digits = normalizePhoneDigits(digitsRaw);
  const chars = PHONE_MASK.split("");
  for (let i = 0; i < PHONE_POSITIONS.length; i++) {
    const pos = PHONE_POSITIONS[i];
    chars[pos] = digits[i] ?? "_";
  }
  return chars.join("");
}

export function displayPhoneFromStored(stored: string | null | undefined): string {
  const raw = (stored ?? "").trim();
  if (!raw) return PHONE_MASK;
  if (raw.includes("_") || raw.includes("(")) return applyPhoneDigits(raw);
  return applyPhoneDigits(raw);
}

export function isCompleteRussianPhone(raw: string): boolean {
  return normalizePhoneDigits(raw).length === 10;
}

export function toE164RussianPhone(raw: string): string {
  const digits = normalizePhoneDigits(raw);
  return digits.length === 10 ? `+7${digits}` : "";
}

export function getRussianPhoneValidationError(raw: string): string | null {
  const digits = normalizePhoneDigits(raw);
  if (!digits.length) return "Укажите номер телефона.";
  if (digits.length < 10) {
    return "Введите номер полностью в формате +7 (000) 000-00-00.";
  }
  return null;
}

export function nextEditablePos(value: string, from: number): number | null {
  for (const pos of PHONE_POSITIONS) {
    if (pos >= from && value[pos] === "_") return pos;
  }
  for (const pos of PHONE_POSITIONS) {
    if (value[pos] === "_") return pos;
  }
  return null;
}

export function prevEditablePos(from: number): number | null {
  for (let i = PHONE_POSITIONS.length - 1; i >= 0; i--) {
    const pos = PHONE_POSITIONS[i];
    if (pos < from) return pos;
  }
  return null;
}
