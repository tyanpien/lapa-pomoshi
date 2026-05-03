import { volunteersApi, type Volunteer } from "@/shared/api/endpoints/volunteers";
import {
  emptyAvailabilityGrid,
  normalizeAvailabilityGrid,
  type AvailabilityGridState,
} from "@/shared/lib/volunteerAvailabilityGrid";

export const VOLUNTEER_PROFILE_UPDATED_EVENT = "volunteer-profile-updated";

export const VOLUNTEER_DETAILS_KEY = "volunteer.profile.details.v1";
export const VOLUNTEER_CATALOG_USER_ID_KEY = "volunteer.profile.catalogUserId.v1";

function normalizeProfileStorageIdentity(identity: string): string {
  return identity.trim().toLowerCase();
}

export function volunteerProfileDetailsStorageKey(userIdentity: string): string {
  return `${VOLUNTEER_DETAILS_KEY}:${normalizeProfileStorageIdentity(userIdentity)}`;
}

export type VolunteerHelpFrequency = "" | "Разовая помощь" | "Регулярная помощь";

export type VolunteerAnimalKindTag = "Собаки" | "Кошки";

export const VOLUNTEER_ANIMAL_KIND_OPTIONS: readonly VolunteerAnimalKindTag[] = ["Собаки", "Кошки"];

export type StoredVolunteerDetails = {
  competencies: string[];
  competenciesOther: string;
  experience: string;
  availabilityDays: string[];
  availabilityTimes: string[];
  location: string;
  travelRadius: string;
  helpFormats: string[];
  helpFormatsOther: string;
  helpFrequency: VolunteerHelpFrequency;
  nightOutings: boolean;
  aboutMe: string;
  animalKinds: VolunteerAnimalKindTag[];
  availabilityGrid: AvailabilityGridState;
  availabilityAroundClock: boolean;
  travelOutOfTown: boolean;
  catalogIsAvailable: boolean | null;
};

export const emptyVolunteerDetails: StoredVolunteerDetails = {
  competencies: [],
  competenciesOther: "",
  experience: "",
  availabilityDays: [],
  availabilityTimes: [],
  location: "",
  travelRadius: "",
  helpFormats: [],
  helpFormatsOther: "",
  helpFrequency: "",
  nightOutings: false,
  aboutMe: "",
  animalKinds: [],
  availabilityGrid: emptyAvailabilityGrid(),
  availabilityAroundClock: false,
  travelOutOfTown: false,
  catalogIsAvailable: null,
};

function normalizeAnimalKinds(raw: unknown): VolunteerAnimalKindTag[] {
  let tokens: string[] = [];
  if (Array.isArray(raw)) {
    tokens = raw.filter((item): item is string => typeof item === "string").map((s) => s.trim());
  } else if (typeof raw === "string") {
    tokens = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  const resolve = (value: string): VolunteerAnimalKindTag | null =>
    VOLUNTEER_ANIMAL_KIND_OPTIONS.find((opt) => opt.toLowerCase() === value.toLowerCase()) ?? null;

  const picked = new Set<VolunteerAnimalKindTag>();
  for (const t of tokens) {
    const kind = resolve(t);
    if (kind) picked.add(kind);
  }

  return VOLUNTEER_ANIMAL_KIND_OPTIONS.filter((opt) => picked.has(opt));
}

export function normalizeVolunteerDetailsFromStorage(parsed: Partial<StoredVolunteerDetails>): StoredVolunteerDetails {
  const hf = parsed.helpFrequency;
  const frequencyOk =
    hf === "Разовая помощь" || hf === "Регулярная помощь"
      ? hf
      : "";

  return {
    competencies: Array.isArray(parsed.competencies)
      ? parsed.competencies
      : parsed.competencies
        ? String(parsed.competencies)
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean)
        : [],
    competenciesOther: parsed.competenciesOther ?? "",
    experience: parsed.experience ?? "",
    availabilityDays: Array.isArray(parsed.availabilityDays)
      ? parsed.availabilityDays
      : parsed.availabilityDays
        ? String(parsed.availabilityDays)
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean)
        : [],
    availabilityTimes: Array.isArray(parsed.availabilityTimes)
      ? parsed.availabilityTimes
      : parsed.availabilityTimes
        ? String(parsed.availabilityTimes)
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean)
        : [],
    location: parsed.location ?? "",
    travelRadius: parsed.travelRadius ?? "",
    helpFormats: Array.isArray(parsed.helpFormats)
      ? parsed.helpFormats
      : parsed.helpFormats
        ? String(parsed.helpFormats)
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean)
        : [],
    helpFormatsOther: parsed.helpFormatsOther ?? "",
    helpFrequency: frequencyOk,
    nightOutings: Boolean(parsed.nightOutings),
    aboutMe: typeof parsed.aboutMe === "string" ? parsed.aboutMe : "",
    animalKinds: normalizeAnimalKinds(parsed.animalKinds),
    availabilityGrid: normalizeAvailabilityGrid(parsed.availabilityGrid),
    availabilityAroundClock: Boolean(parsed.availabilityAroundClock),
    travelOutOfTown: Boolean(parsed.travelOutOfTown),
    catalogIsAvailable:
      parsed.catalogIsAvailable === true || parsed.catalogIsAvailable === false ? parsed.catalogIsAvailable : null,
  };
}

export function resolveVolunteerCatalogIsAvailable(
  apiIsAvailable: boolean,
  overlay: StoredVolunteerDetails | null | undefined
): boolean {
  if (overlay && overlay.catalogIsAvailable !== null) {
    return overlay.catalogIsAvailable;
  }
  return Boolean(apiIsAvailable);
}

export type VolunteerCatalogLinkResult = {
  catalogUserId: number | null;
  listIsAvailable: boolean | null;
};

export function readVolunteerDetailsFromStorage(
  userIdentity: string | null | undefined
): StoredVolunteerDetails {
  if (!userIdentity?.trim()) {
    return { ...emptyVolunteerDetails };
  }
  try {
    const raw = localStorage.getItem(volunteerProfileDetailsStorageKey(userIdentity));
    if (!raw) return { ...emptyVolunteerDetails };
    const parsed = JSON.parse(raw) as Partial<StoredVolunteerDetails>;
    return normalizeVolunteerDetailsFromStorage(parsed);
  } catch {
    return { ...emptyVolunteerDetails };
  }
}

export function writeVolunteerDetailsToStorage(
  userIdentity: string | null | undefined,
  details: StoredVolunteerDetails
): void {
  if (!userIdentity?.trim()) return;
  try {
    localStorage.setItem(volunteerProfileDetailsStorageKey(userIdentity), JSON.stringify(details));
  } catch {
  }
}

export function readLinkedVolunteerCatalogUserId(): number | null {
  try {
    const raw = localStorage.getItem(VOLUNTEER_CATALOG_USER_ID_KEY);
    if (!raw?.trim()) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

export async function syncVolunteerCatalogUserId(displayName: string): Promise<VolunteerCatalogLinkResult> {
  const needle = displayName.trim().toLowerCase();
  if (!needle) {
    return { catalogUserId: null, listIsAvailable: null };
  }

  try {
    const list = await volunteersApi.getList();
    const items: Volunteer[] = list.items ?? [];
    const exact = items.find((v: Volunteer) => v.full_name?.trim().toLowerCase() === needle);
    const match = exact ?? items.find((v: Volunteer) => v.full_name?.trim().toLowerCase().includes(needle));
    const id = match?.user_id;

    if (typeof id === "number" && id > 0) {
      localStorage.setItem(VOLUNTEER_CATALOG_USER_ID_KEY, String(id));
      return {
        catalogUserId: id,
        listIsAvailable: typeof match?.is_available === "boolean" ? match.is_available : null,
      };
    }

    localStorage.removeItem(VOLUNTEER_CATALOG_USER_ID_KEY);
    return { catalogUserId: null, listIsAvailable: null };
  } catch {
    return { catalogUserId: null, listIsAvailable: null };
  }
}
