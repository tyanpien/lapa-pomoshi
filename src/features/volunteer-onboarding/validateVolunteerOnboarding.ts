import type { CatalogOption } from "@/shared/api/endpoints/volunteers";
import { buildCompetencySlugsFromLabels } from "@/shared/lib/volunteerMeProfileMap";
import type { StoredVolunteerDetails } from "@/shared/lib/volunteerProfileStorage";

function experienceSlugFromLabel(label: string, levels: CatalogOption[]): string | null {
  const t = label.trim();
  if (!t) return null;
  const row = levels.find((x) => x.id === t || x.label.trim() === t);
  if (row) return row.id;
  const low = t.toLowerCase();
  const ci = levels.find((x) => x.label.trim().toLowerCase() === low);
  if (ci) return ci.id;
  const ruToSlug: Record<string, string> = {
    Новичок: "beginner",
    Опытный: "experienced",
    "Ветеринарное образование": "vet_education",
  };
  return ruToSlug[t] ?? null;
}

export function validateVolunteerOnboarding(
  details: StoredVolunteerDetails,
  competencyCatalog: CatalogOption[],
  experienceCatalog: CatalogOption[],
): string | null {
  if (!details.location.trim()) {
    return "Укажите город или район — это нужно для подбора задач рядом с вами.";
  }

  const competency_slugs = buildCompetencySlugsFromLabels(
    details.competencies,
    details.competenciesOther,
    competencyCatalog,
  );
  if (competency_slugs.length === 0) {
    return "Выберите хотя бы одну компетенцию.";
  }

  if (!details.experience.trim()) {
    return "Укажите уровень опыта.";
  }
  if (!experienceSlugFromLabel(details.experience, experienceCatalog)) {
    return "Выберите уровень опыта из списка.";
  }

  return null;
}
