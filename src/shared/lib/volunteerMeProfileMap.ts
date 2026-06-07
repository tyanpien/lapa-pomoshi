import type { MeVolunteerProfileOut, VolunteerSelfPatch, VolunteerWeeklySlot } from "@/shared/api/endpoints/meProfile";
import type { StoredVolunteerDetails } from "@/shared/lib/volunteerProfileStorage";
import {
  emptyAvailabilityGrid,
  emptyDayRanges,
  formatAvailabilitySummary,
  isActiveDayRange,
  type AvailabilityDayRangesState,
  type WeekdayKey,
  WEEKDAY_KEYS,
} from "@/shared/lib/volunteerAvailabilityGrid";

const VOL_UI_MARK = "\n---VOL-UI---\n";

const SLUG_TO_WK: Record<string, WeekdayKey> = {
  monday: "mon",
  tuesday: "tue",
  wednesday: "wed",
  thursday: "thu",
  friday: "fri",
  saturday: "sat",
  sunday: "sun",
};

const WK_TO_SLUG: Record<WeekdayKey, string> = {
  mon: "monday",
  tue: "tuesday",
  wed: "wednesday",
  thu: "thursday",
  fri: "friday",
  sat: "saturday",
  sun: "sunday",
};

export type CatalogOption = { id: string; label: string };

const FALLBACK_COMPETENCY_LABEL_BY_SLUG: Record<string, string> = {
  walk: "Выгул / уход",
  photo_video: "Фото / видео",
  foster: "Передержка",
  texts_social: "SMM / тексты",
  manual: "Помощь в приюте",
  auto: "Автопомощь",
  medical: "Медицина",
  rescue: "Спасение",
  events: "Мероприятия",
  fundraising: "Фандрайзинг",
  other: "Другое",
};

const HELP_FORMAT_TO_UI: Record<string, string> = {
  one_time: "Разовая помощь",
  recurring: "Регулярная помощь",
};

export function resolveVolunteerHelpFormatLabel(
  helpFormat?: string | null,
  helpFormatLabel?: string | null
): string | null {
  const fromApi = helpFormatLabel?.trim();
  if (fromApi) return fromApi;
  if (helpFormat && helpFormat in HELP_FORMAT_TO_UI) {
    return HELP_FORMAT_TO_UI[helpFormat];
  }
  return null;
}

const UI_TO_HELP_FORMAT: Record<string, string> = {
  "Разовая помощь": "one_time",
  "Регулярная помощь": "recurring",
};

const EXP_SLUG_TO_FALLBACK_LABEL: Record<string, string> = {
  beginner: "Новичок",
  experienced: "Опытный",
  vet_education: "Ветеринарное образование",
};

const ANIMAL_SLUG_TO_KIND: Record<string, "Собаки" | "Кошки"> = {
  dog: "Собаки",
  cat: "Кошки",
};

const KIND_TO_ANIMAL_SLUG: Record<string, string> = {
  Собаки: "dog",
  Кошки: "cat",
};

export type VolUiExtra = {
  helpFormats: string[];
  helpFormatsOther: string;
  competenciesOther: string;
};

function parseVolExtra(availability: string | null | undefined): {
  summary: string;
  extra: VolUiExtra;
} {
  const raw = (availability ?? "").trim();
  if (!raw.includes(VOL_UI_MARK)) {
    return {
      summary: raw,
      extra: { helpFormats: [], helpFormatsOther: "", competenciesOther: "" },
    };
  }
  const [head, jsonPart] = raw.split(VOL_UI_MARK);
  try {
    const parsed = JSON.parse(jsonPart ?? "{}") as Partial<VolUiExtra>;
    return {
      summary: (head ?? "").trim(),
      extra: {
        helpFormats: Array.isArray(parsed.helpFormats) ? parsed.helpFormats : [],
        helpFormatsOther: typeof parsed.helpFormatsOther === "string" ? parsed.helpFormatsOther : "",
        competenciesOther: typeof parsed.competenciesOther === "string" ? parsed.competenciesOther : "",
      },
    };
  } catch {
    return {
      summary: head.trim(),
      extra: { helpFormats: [], helpFormatsOther: "", competenciesOther: "" },
    };
  }
}

function weeklyToRangesAndClock(weekly: VolunteerWeeklySlot[]): {
  ranges: AvailabilityDayRangesState;
  aroundClock: boolean;
} {
  const ranges = emptyDayRanges();
  for (const slot of weekly) {
    const wk = SLUG_TO_WK[slot.weekday];
    if (!wk) continue;
    const r0 = slot.ranges?.[0];
    if (r0) {
      ranges[wk] = { from: r0.start, to: r0.end };
    }
  }
  const activeDays = WEEKDAY_KEYS.filter((k) => isActiveDayRange(ranges[k]));
  const aroundClock =
    WEEKDAY_KEYS.length > 0 &&
    WEEKDAY_KEYS.every((k) => {
      const r = ranges[k];
      return r.from === "00:00" && (r.to === "23:59" || r.to === "24:00");
    });
  if (activeDays.length === 0) {
    return { ranges, aroundClock: false };
  }
  return { ranges, aroundClock };
}

function labelsFromCompetencyApi(vp: MeVolunteerProfileOut): string[] {
  const n = Math.min(vp.competency_slugs.length, vp.competency_labels.length);
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    out.push(vp.competency_labels[i] ?? FALLBACK_COMPETENCY_LABEL_BY_SLUG[vp.competency_slugs[i]] ?? vp.competency_slugs[i]);
  }
  for (let i = n; i < vp.competency_slugs.length; i++) {
    const s = vp.competency_slugs[i];
    out.push(FALLBACK_COMPETENCY_LABEL_BY_SLUG[s] ?? s);
  }
  return out;
}

function experienceLabelFromApi(slug: string | null, levels: CatalogOption[]): string {
  if (!slug) return "";
  const row = levels.find((x) => x.id === slug);
  if (row) return row.label;
  return EXP_SLUG_TO_FALLBACK_LABEL[slug] ?? slug;
}

export function volunteerApiToStoredDetails(
  vp: MeVolunteerProfileOut,
  experienceCatalog: CatalogOption[],
): StoredVolunteerDetails {
  const { summary: availabilityPlainFromApi, extra } = parseVolExtra(vp.availability);

  const { ranges, aroundClock } = weeklyToRangesAndClock(vp.weekly_availability ?? []);

  const competencies = labelsFromCompetencyApi(vp);
  const hasOtherSlug = vp.competency_slugs.includes("other");
  const competenciesOther = extra.competenciesOther || (hasOtherSlug ? "" : "");

  const animalKinds = (vp.animal_types ?? [])
    .map((id) => ANIMAL_SLUG_TO_KIND[id])
    .filter((x): x is "Собаки" | "Кошки" => x === "Собаки" || x === "Кошки");

  const helpFrequency =
    vp.help_format === "one_time" || vp.help_format === "recurring"
      ? HELP_FORMAT_TO_UI[vp.help_format]
      : ("" as StoredVolunteerDetails["helpFrequency"]);

  return {
    competencies,
    competenciesOther,
    experience: experienceLabelFromApi(vp.experience_level, experienceCatalog),
    availabilityDays: [],
    availabilityTimes: [],
    location: vp.location_city ?? "",
    travelRadius:
      vp.travel_radius_km != null && vp.travel_radius_km >= 0 ? String(vp.travel_radius_km) : "",
    helpFormats: extra.helpFormats,
    helpFormatsOther: extra.helpFormatsOther,
    helpFrequency: helpFrequency === "Разовая помощь" || helpFrequency === "Регулярная помощь" ? helpFrequency : "",
    nightOutings: Boolean(vp.accepts_night_urgency),
    aboutMe: vp.about_me ?? "",
    animalKinds,
    availabilityGrid: emptyAvailabilityGrid(),
    availabilityAroundClock: aroundClock,
    availabilityDayRanges: ranges,
    travelOutOfTown: Boolean(vp.travel_area_mode === "region" || vp.can_travel_other_area),
    catalogIsAvailable: vp.is_available,
    availabilityPlainText: availabilityPlainFromApi.trim(),
  };
}

function labelToCompetencySlug(label: string, competencies: CatalogOption[]): string | null {
  const t = label.trim();
  if (!t) return null;
  const exact = competencies.find((c) => c.label.trim() === t);
  if (exact) return exact.id;
  const low = t.toLowerCase();
  const ci = competencies.find((c) => c.label.trim().toLowerCase() === low);
  if (ci) return ci.id;

  const uiAliasSlug: Record<string, string> = {
    "фото / видеосъемка": "photo_video",
    "фото / видео": "photo_video",
    "выгул / уход": "walk",
    "помощь руками": "manual",
    "помощь в приюте": "manual",
    "тексты / соцсети": "texts_social",
    "smm / тексты": "texts_social",
    "медицинская помощь": "medical",
    "медицина": "medical",
    "автопомощь": "auto",
  };
  const alias = uiAliasSlug[low];
  if (alias) return alias;

  for (const [slug, lab] of Object.entries(FALLBACK_COMPETENCY_LABEL_BY_SLUG)) {
    if (lab === t || lab.toLowerCase() === low) return slug;
  }
  return null;
}

export function buildCompetencySlugsFromLabels(
  selectedLabels: string[],
  competenciesOther: string,
  competencies: CatalogOption[],
): string[] {
  const slugs: string[] = [];
  for (const lab of selectedLabels) {
    if (lab === "Другое") {
      slugs.push("other");
      continue;
    }
    const id = labelToCompetencySlug(lab, competencies);
    if (id) slugs.push(id);
  }
  return slugs;
}

export function syncCompetencyLabelsWithCatalog(selected: string[], catalog: CatalogOption[]): string[] {
  if (!catalog.length) return selected;
  const hasOther = selected.some((x) => x.trim() === "Другое");
  const sansOther = selected.filter((x) => x.trim() !== "Другое");
  const slugs = buildCompetencySlugsFromLabels(sansOther, "", catalog);
  const labels: string[] = [];
  for (const slug of slugs) {
    const row = catalog.find((c) => c.id === slug);
    if (row?.label) labels.push(row.label);
  }
  if (hasOther) labels.push("Другое");
  return labels;
}

function parseTravelRadiusKm(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  const m = s.match(/(\d+)/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  if (!Number.isFinite(n) || n < 0 || n > 5000) return null;
  return n;
}

function buildWeeklySlots(details: StoredVolunteerDetails): VolunteerWeeklySlot[] {
  if (details.availabilityAroundClock) {
    return WEEKDAY_KEYS.map((k) => ({
      weekday: WK_TO_SLUG[k],
      ranges: [{ start: "00:00", end: "23:59" }],
    }));
  }
  const out: VolunteerWeeklySlot[] = [];
  for (const k of WEEKDAY_KEYS) {
    const r = details.availabilityDayRanges[k];
    if (!isActiveDayRange(r)) continue;
    out.push({
      weekday: WK_TO_SLUG[k],
      ranges: [{ start: r.from, end: r.to }],
    });
  }
  return out;
}

function buildAvailabilityPayload(details: StoredVolunteerDetails, summary: string): string {
  const extra: VolUiExtra = {
    helpFormats: details.helpFormats,
    helpFormatsOther: details.helpFormatsOther,
    competenciesOther: details.competenciesOther,
  };
  return `${summary}${VOL_UI_MARK}${JSON.stringify(extra)}`;
}

function experienceSlugFromLabel(label: string, levels: CatalogOption[]): string | null {
  const t = label.trim();
  if (!t) return null;
  const row = levels.find((x) => x.label.trim() === t);
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

function animalTypesFromKinds(kinds: StoredVolunteerDetails["animalKinds"]): string[] {
  const ids: string[] = [];
  for (const k of kinds) {
    const id = KIND_TO_ANIMAL_SLUG[k];
    if (id) ids.push(id);
  }
  return ids;
}

export function storedDetailsToVolunteerPatch(
  details: StoredVolunteerDetails,
  options: {
    competencyCatalog: CatalogOption[];
    experienceCatalog: CatalogOption[];
  },
): VolunteerSelfPatch {
  const slice = {
    availabilityGrid: details.availabilityGrid,
    availabilityAroundClock: details.availabilityAroundClock,
    availabilityDayRanges: details.availabilityDayRanges,
  };
  const summary =
    formatAvailabilitySummary(slice).trim() || (details.availabilityPlainText ?? "").trim();
  const availabilityStored = buildAvailabilityPayload(details, summary);

  const hf = details.helpFrequency;
  const help_format =
    hf === "Разовая помощь" || hf === "Регулярная помощь" ? UI_TO_HELP_FORMAT[hf] : undefined;

  const competency_slugs = buildCompetencySlugsFromLabels(
    details.competencies,
    details.competenciesOther,
    options.competencyCatalog,
  );

  const experience_level = experienceSlugFromLabel(details.experience, options.experienceCatalog);

  const tr = parseTravelRadiusKm(details.travelRadius);

  return {
    about_me: details.aboutMe.trim() || null,
    availability: availabilityStored,
    location_city: details.location.trim() || null,
    travel_radius_km: tr,
    help_format: help_format ?? undefined,
    weekly_availability: buildWeeklySlots(details),
    accepts_night_urgency: details.nightOutings,
    travel_area_mode: details.travelOutOfTown ? "region" : "whole_city",
    animal_types: animalTypesFromKinds(details.animalKinds),
    competency_slugs,
    experience_level: experience_level ?? undefined,
    is_available:
      details.catalogIsAvailable === null || details.catalogIsAvailable === undefined
        ? true
        : Boolean(details.catalogIsAvailable),
    can_travel_other_area: details.travelOutOfTown,
  };
}
