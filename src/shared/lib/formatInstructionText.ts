export function formatInstructionDisplayText(text: string): string {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return "";

  if (normalized.includes("\n")) {
    return normalized.replace(/\n{3,}/g, "\n\n");
  }

  let result = normalized.replace(/\s+(?=\d+\.\s)/g, "\n");
  result = result.replace(/\s+(?=Принимаем\b)/u, "\n\n");
  return result.replace(/\n{3,}/g, "\n\n").trim();
}
