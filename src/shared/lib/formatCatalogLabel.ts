import { translateCatalogSlug } from "@/shared/lib/catalogSlugLabels";

export function formatCatalogLabel(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) return "";
  const translated = translateCatalogSlug(trimmed);
  if (translated) return translated;
  return trimmed
    .split(/\s+/)
    .map((word) => {
      if (!word) return word;
      const first = word.charAt(0).toUpperCase();
      const rest = word.slice(1);
      return first + rest;
    })
    .join(" ");
}
