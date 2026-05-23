export type VolunteerCompetencyOption = { id: string; label: string };

export const VOLUNTEER_COMPETENCY_OPTIONS: VolunteerCompetencyOption[] = [
  { id: "walk", label: "Выгул / уход" },
  { id: "photo_video", label: "Фото / видео" },
  { id: "foster", label: "Передержка" },
  { id: "texts_social", label: "SMM / тексты" },
  { id: "manual", label: "Помощь в приюте" },
  { id: "auto", label: "Автопомощь" },
  { id: "medical", label: "Медицина" },
  { id: "rescue", label: "Спасение" },
  { id: "events", label: "Мероприятия" },
  { id: "fundraising", label: "Фандрайзинг" },
  { id: "other", label: "Другое" },
];

export const VOLUNTEER_COMPETENCY_LABEL_BY_SLUG: Record<string, string> = Object.fromEntries(
  VOLUNTEER_COMPETENCY_OPTIONS.map((x) => [x.id, x.label]),
);

export const VOLUNTEER_COMPETENCY_SLUGS = new Set(VOLUNTEER_COMPETENCY_OPTIONS.map((x) => x.id));

export function resolveVolunteerTaskTypeSlug(
  helpType: string | null | undefined,
  volunteerCompetencies?: string[] | null,
): string {
  const ht = (helpType ?? "").trim().toLowerCase();
  if (ht && VOLUNTEER_COMPETENCY_SLUGS.has(ht)) return ht;
  for (const c of volunteerCompetencies ?? []) {
    const slug = (c ?? "").trim().toLowerCase();
    if (slug && VOLUNTEER_COMPETENCY_SLUGS.has(slug)) return slug;
  }
  return ht || "manual";
}
