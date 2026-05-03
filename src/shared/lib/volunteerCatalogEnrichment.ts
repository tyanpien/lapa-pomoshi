import type { Volunteer } from "@/shared/api/endpoints/volunteers";
import { VOLUNTEER_ANIMAL_KIND_OPTIONS, type StoredVolunteerDetails } from "./volunteerProfileStorage";

function dedupeCaseInsensitivePreserveFirst(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const t = typeof raw === "string" ? raw.trim() : "";
    if (!t) continue;
    const low = t.toLowerCase();
    if (seen.has(low)) continue;
    seen.add(low);
    out.push(t);
  }
  return out;
}

export function mergeVolunteerFilterCompetencyTags(
  v: Volunteer,
  enrichment: StoredVolunteerDetails | null
): string[] {
  const merged: string[] = [...(v.competency_tags ?? [])];

  if (enrichment) {
    for (const c of enrichment.competencies) {
      if (c === "Другое") {
        merged.push(
          enrichment.competenciesOther.trim()
            ? `Другое: ${enrichment.competenciesOther.trim()}`
            : "Другое"
        );
      } else {
        merged.push(c);
      }
    }
  }

  return dedupeCaseInsensitivePreserveFirst(merged);
}

export function mergeVolunteerAnimalTypes(v: Volunteer, enrichment: StoredVolunteerDetails | null): string[] {
  const merged: string[] = [...(v.animal_types ?? [])];
  if (enrichment?.animalKinds?.length) {
    merged.push(...enrichment.animalKinds);
  }
  return dedupeCaseInsensitivePreserveFirst(merged);
}

export type CatalogCardChipVariant = "format" | "pet" | "skill";

export function buildVolunteerCatalogCardChips(
  v: Volunteer,
  enrichment: StoredVolunteerDetails | null,
  maxVisible = 6
): { label: string; variant: CatalogCardChipVariant }[] {
  const chips: { label: string; variant: CatalogCardChipVariant }[] = [];
  const seen = new Set<string>();

  const push = (label: string, variant: CatalogCardChipVariant) => {
    const t = label.trim();
    if (!t) return;
    const low = t.toLowerCase();
    if (seen.has(low)) return;
    seen.add(low);
    chips.push({ label: t, variant });
  };

  if (enrichment?.helpFrequency?.trim()) {
    push(enrichment.helpFrequency.trim(), "format");
  }

  const mergedAnimals = mergeVolunteerAnimalTypes(v, enrichment);
  for (const opt of VOLUNTEER_ANIMAL_KIND_OPTIONS) {
    const has = mergedAnimals.some((a) => a.toLowerCase() === opt.toLowerCase());
    if (has) push(opt, "pet");
  }

  const mergedSkills = mergeVolunteerFilterCompetencyTags(v, enrichment);
  const hfLow = enrichment?.helpFrequency?.trim().toLowerCase() ?? "";

  for (const t of mergedSkills) {
    const low = t.toLowerCase();
    if (hfLow && low === hfLow) continue;
    if (VOLUNTEER_ANIMAL_KIND_OPTIONS.some((o) => o.toLowerCase() === low)) continue;
    push(t, "skill");
  }

  return chips.slice(0, maxVisible);
}
