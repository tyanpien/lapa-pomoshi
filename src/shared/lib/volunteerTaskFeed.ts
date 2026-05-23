import type { UrgentItem, UrgentRequestDetail } from "@/shared/api/endpoints/urgent";
import {
  VOLUNTEER_COMPETENCY_SLUGS,
  resolveVolunteerTaskTypeSlug,
} from "@/shared/lib/volunteerCompetencyCatalog";

const HELP_TYPE_TO_COMPETENCY_SLUGS: Record<string, string[]> = {
  manual: ["manual"],
  auto: ["auto"],
  medical: ["medical"],
  foster: ["foster"],
  financial: ["fundraising"],
  food: ["manual"],
  feed: ["manual"],
  default: [],
};

function normalizeHelpTypeKey(raw: string | null | undefined): string {
  const h = (raw ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  if (!h) return "";
  const alias: Record<string, string> = {
    автопомощь: "auto",
    "авто_помощь": "auto",
    финансовая_помощь: "financial",
    "помощь_руками": "manual",
    передержка: "foster",
  };
  return alias[h] ?? h;
}

const LABEL_HINT_TO_SLUG: { pattern: RegExp; slug: string }[] = [
  { pattern: /автопомощ|авто[\s-]*помощ/i, slug: "auto" },
  { pattern: /выгул|уход|прогул|гулять/i, slug: "walk" },
  { pattern: /фото|видео|съ[её]м|smm|соцсет|instagram|tiktok/i, slug: "photo_video" },
  { pattern: /передерж/i, slug: "foster" },
  { pattern: /текст|соцсет|smm|контент/i, slug: "texts_social" },
  { pattern: /приют|уборк|кормлен|накорм|вольер|санитар/i, slug: "manual" },
  { pattern: /перевоз|транспорт|авто|машин|подвез/i, slug: "auto" },
  { pattern: /вет|медицин|лечен|операц/i, slug: "medical" },
  { pattern: /спасен/i, slug: "rescue" },
  { pattern: /мероприят/i, slug: "events" },
  { pattern: /сбор|фандрайз|деньг|оплат|пожертв/i, slug: "fundraising" },
];

export function normalizeCityToken(city: string | null | undefined): string {
  let s = (city ?? "")
    .trim()
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/\s+/g, " ");
  s = s.replace(/^г\.?\s+/u, "").replace(/^город\s+/u, "");
  return s.trim();
}

export function citiesMatchForVolunteerTask(
  volunteerCity: string | null | undefined,
  taskCity: string | null | undefined,
): boolean {
  const v = normalizeCityToken(volunteerCity);
  if (!v) return true;
  const t = normalizeCityToken(taskCity);
  if (!t) return true;
  if (v === t) return true;
  if (t.includes(v) || v.includes(t)) return true;
  const vParts = v.split(/[,;]/).map((p) => p.trim()).filter(Boolean);
  const tParts = t.split(/[,;]/).map((p) => p.trim()).filter(Boolean);
  for (const a of vParts.length ? vParts : [v]) {
    for (const b of tParts.length ? tParts : [t]) {
      if (a === b || b.includes(a) || a.includes(b)) return true;
    }
  }
  return false;
}

function inferSlugFromFreeText(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  const low = s.toLowerCase();
  if (VOLUNTEER_COMPETENCY_SLUGS.has(low)) return low;
  if (/автопомощ|авто[\s-]*помощ/i.test(s)) return "auto";
  for (const { pattern, slug } of LABEL_HINT_TO_SLUG) {
    if (pattern.test(s)) return slug;
  }
  return null;
}

export function collectTaskCompetencySlugs(task: UrgentItem): string[] {
  const d = task as UrgentRequestDetail;
  const out = new Set<string>();

  const primary = resolveVolunteerTaskTypeSlug(task.help_type, d.volunteer_competencies);
  if (VOLUNTEER_COMPETENCY_SLUGS.has(primary)) out.add(primary);

  for (const c of d.volunteer_competencies ?? []) {
    const slug = inferSlugFromFreeText(String(c));
    if (slug) out.add(slug);
  }

  const req = (d.volunteer_requirements ?? "").trim();
  if (req) {
    const slug = inferSlugFromFreeText(req);
    if (slug) out.add(slug);
    for (const { pattern, slug: sl } of LABEL_HINT_TO_SLUG) {
      if (pattern.test(req)) out.add(sl);
    }
  }

  const blob = `${task.title ?? ""} ${task.description ?? ""}`;
  for (const { pattern, slug } of LABEL_HINT_TO_SLUG) {
    if (pattern.test(blob)) out.add(slug);
  }

  const ht = normalizeHelpTypeKey(task.help_type);
  if (VOLUNTEER_COMPETENCY_SLUGS.has(ht)) {
    out.add(ht);
  } else {
    const fromType = HELP_TYPE_TO_COMPETENCY_SLUGS[ht] ?? HELP_TYPE_TO_COMPETENCY_SLUGS.default ?? [];
    for (const s of fromType) out.add(s);
  }

  const slugFromHelpTypeLabel = inferSlugFromFreeText(task.help_type ?? "");
  if (slugFromHelpTypeLabel) out.add(slugFromHelpTypeLabel);

  return [...out];
}

export function taskMatchesVolunteerCompetencies(task: UrgentItem, volunteerCompetencySlugs: string[]): boolean {
  if (!volunteerCompetencySlugs.length) return true;
  const vol = new Set(volunteerCompetencySlugs.map((s) => s.trim().toLowerCase()).filter(Boolean));
  const taskSlugs = collectTaskCompetencySlugs(task);
  if (!taskSlugs.length) return false;
  return taskSlugs.some((s) => vol.has(s.toLowerCase()));
}

export function sortVolunteerPersonalizedTasks(tasks: UrgentItem[]): UrgentItem[] {
  return [...tasks].sort((a, b) => {
    const ua = a.is_urgent ? 1 : 0;
    const ub = b.is_urgent ? 1 : 0;
    if (ua !== ub) return ub - ua;
    return a.id - b.id;
  });
}

export function filterVolunteerPersonalizedFeed(
  tasks: UrgentItem[],
  options: {
    volunteerCity: string | null | undefined;
    volunteerCompetencySlugs: string[];
  },
): UrgentItem[] {
  const byCity = tasks.filter((t) => citiesMatchForVolunteerTask(options.volunteerCity, t.city));
  const byComp = byCity.filter((t) => taskMatchesVolunteerCompetencies(t, options.volunteerCompetencySlugs));
  return sortVolunteerPersonalizedTasks(byComp);
}
