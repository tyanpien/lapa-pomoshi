export const URGENT_HELP_TYPE_LABELS: Record<string, string> = {
  financial: "Финансовая помощь",
  foster: "Передержка",
  manual: "Помощь руками",
  auto: "Автопомощь",
  medical: "Лекарства и кровь",
  food: "Накормить",
  feed: "Накормить",
};

function splitHelpTypeList(raw: string): string[] {
  const s = (raw ?? "").trim();
  if (!s) return [];
  const parts = s
    .split(/[,;|]/g)
    .flatMap((p) => p.split(/\s+/g))
    .map((p) => p.trim())
    .filter(Boolean);
  const joined = parts.join("");
  if (!joined) return [];
  if (/[А-Яа-яЁё]/.test(s)) return [];
  if (!/^[a-z0-9_-]+$/i.test(joined)) return [];
  return parts;
}

export function humanizeHelpTypeList(raw: string): string {
  const parts = splitHelpTypeList(raw);
  if (!parts.length) return raw;
  const labels = parts.map((p) => getUrgentHelpTypeLabel(p));
  const changed = labels.some((l, i) => l !== parts[i]);
  return changed ? labels.join(", ") : raw;
}

export function getUrgentHelpTypeLabel(helpType: string): string {
  const key = helpType.trim();
  return URGENT_HELP_TYPE_LABELS[key] ?? helpType;
}

const URGENT_HELP_TYPE_SHORT_TAGS: Record<string, string> = {
  financial: "сбор",
  foster: "передержка",
  manual: "руками",
  auto: "авто",
  medical: "медицина",
  food: "корм",
  feed: "корм",
};

function shortTagSingle(helpType: string): string {
  const key = helpType.trim().toLowerCase();
  return URGENT_HELP_TYPE_SHORT_TAGS[key] ?? getUrgentHelpTypeLabel(helpType).slice(0, 14).toLowerCase();
}

export function getUrgentHelpTypeShortTag(helpType: string): string {
  const list = splitHelpTypeList(helpType);
  if (list.length) {
    const mapped = list.map((x) => shortTagSingle(x));
    const joined = mapped.join(", ");
    return joined.slice(0, 22);
  }

  return shortTagSingle(helpType);
}

export type OrganizationRequestHelpFilterCategory = "Приютить" | "Накормить" | "Вылечить" | "Другое";

export function helpTypeToOrganizationRequestFilterCategory(
  helpType: string
): OrganizationRequestHelpFilterCategory {
  const v = helpType.trim();
  if (v === "Приютить" || v === "Накормить" || v === "Вылечить") return v;

  const lower = v.toLowerCase();
  const bySlug: Record<string, OrganizationRequestHelpFilterCategory> = {
    food: "Накормить",
    feed: "Накормить",
    medical: "Вылечить",
    heal: "Вылечить",
    treatment: "Вылечить",
    adopt: "Приютить",
  };
  const mapped = bySlug[lower];
  if (mapped) return mapped;

  if (lower.includes("накорм") || lower.includes("корм")) return "Накормить";
  if (lower.includes("леч") || lower.includes("лекарств") || lower.includes("медиц")) return "Вылечить";
  if (lower.includes("приют") || lower.includes("пристро")) return "Приютить";

  return "Другое";
}
