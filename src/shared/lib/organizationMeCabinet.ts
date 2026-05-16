import type { Animal } from "@/shared/api/endpoints/animals";
import { getImageUrl } from "@/shared/api/client";
import {
  fetchOrgAnimalsAllPages,
  fetchOrgHelpRequestsAllPages,
  meOrganizationApi,
} from "@/shared/api/endpoints/meOrganization";
import type { OrganizationListItem, OrganizationPublicPage } from "@/shared/api/endpoints/organizations";
import { organizationsApi } from "@/shared/api/endpoints/organizations";
import type { UrgentItem, UrgentRequestDetail } from "@/shared/api/endpoints/urgent";
import type {
  GreetingFromHome,
  OrganizationProfileData,
  OrganizationReport,
  OrganizationSocialExtra,
} from "@/shared/lib/organizationCabinet";
import { saveOrganizationProfile } from "@/shared/lib/organizationCabinet";
import {
  mapPublicArticleToCabinet,
  mapPublicEventToCabinet,
  mapPublicUrgentToRequest,
  type OrganizationCabinetApiPayload,
} from "@/shared/lib/organizationPublicCabinet";

export function unwrapApiList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object" && "items" in data) {
    const items = (data as { items?: unknown }).items;
    if (Array.isArray(items)) return items as T[];
  }
  return [];
}

function pickStr(v: unknown): string {
  return typeof v === "string" ? v : "";
}

export function tryParseOrganizationPublicPage(data: unknown): OrganizationPublicPage | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  if (typeof o.hero === "object" && o.hero !== null) return data as OrganizationPublicPage;
  return null;
}

function parseOrganizationId(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && /^\d+$/.test(v.trim())) {
    const n = Number(v.trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function isOrgCabinetProfileResponse(data: unknown): data is Record<string, unknown> {
  if (!data || typeof data !== "object") return false;
  const o = data as Record<string, unknown>;
  if (o.profile === null || typeof o.profile !== "object") return false;
  const oid = parseOrganizationId(o.organization_id);
  if (oid != null) return true;
  return typeof o.contacts === "object" && o.contacts !== null && typeof o.about === "object" && o.about !== null;
}

const PLATFORM_LABEL: Record<string, string> = {
  vk: "VK",
  telegram: "Telegram",
  whatsapp: "WhatsApp",
};

function socialRowsToProfileFields(
  rows: unknown[]
): Pick<OrganizationProfileData, "vkUrl" | "telegramUrl" | "whatsappUrl" | "extraSocialLinks"> {
  let vkUrl = "";
  let telegramUrl = "";
  let whatsappUrl = "";
  const extra: OrganizationSocialExtra[] = [];
  let extraIdx = 0;
  for (const item of rows) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const url = pickStr(o.url).trim();
    if (!url) continue;
    const platform = pickStr(o.platform).toLowerCase();
    const label = (PLATFORM_LABEL[platform] || pickStr(o.label) || platform || "Ссылка").trim();
    if (platform === "vk" || (!platform && (url.includes("vk.com") || label.toLowerCase().includes("vk")))) {
      if (!vkUrl) vkUrl = url;
      continue;
    }
    if (
      platform === "telegram" ||
      (!platform && (url.includes("t.me") || label.toLowerCase().includes("telegram")))
    ) {
      if (!telegramUrl) telegramUrl = url;
      continue;
    }
    if (
      platform === "whatsapp" ||
      (!platform && (url.includes("wa.me") || label.toLowerCase().includes("whatsapp")))
    ) {
      if (!whatsappUrl) whatsappUrl = url;
      continue;
    }
    extra.push({ id: `soc-${extraIdx++}`, messenger: label || "Ссылка", url });
  }
  return { vkUrl, telegramUrl, whatsappUrl, extraSocialLinks: extra };
}

export function mapOrgCabinetProfileResponseToProfileData(
  raw: Record<string, unknown>,
  listItem: OrganizationListItem | null,
  ownerHint: string
): OrganizationProfileData {
  const profile = (raw.profile as Record<string, unknown>) ?? {};
  const contacts = (raw.contacts as Record<string, unknown>) ?? {};
  const about = (raw.about as Record<string, unknown>) ?? {};
  const instructions = (raw.instructions as Record<string, unknown>) ?? {};

  const socialRows = Array.isArray(contacts.social_links) ? (contacts.social_links as unknown[]) : [];
  const { vkUrl, telegramUrl, whatsappUrl, extraSocialLinks } = socialRowsToProfileFields(socialRows);

  const galleryItems = Array.isArray(about.gallery) ? (about.gallery as unknown[]) : [];
  const galleryDataUrls: string[] = [];
  for (const g of galleryItems) {
    if (!g || typeof g !== "object") continue;
    const u = pickStr((g as Record<string, unknown>).url).trim();
    if (u) galleryDataUrls.push(getImageUrl(u));
  }

  const name = pickStr(profile.name) || listItem?.name?.trim() || ownerHint;
  const logo = pickStr(profile.logo_url);
  const cover = pickStr(profile.cover_url);

  const adoptionHowto = pickStr(instructions.adoption_howto);
  const admissionRules = pickStr(instructions.admission_rules);

  return {
    organizationName: name.trim() || ownerHint,
    specialization: pickStr(profile.specialization) || listItem?.specialization?.trim() || "",
    description: pickStr(profile.description),
    territory: pickStr(profile.city) || listItem?.city?.trim() || "",
    contacts: "",
    phone: pickStr(contacts.phone),
    email: pickStr(contacts.email),
    vkUrl,
    telegramUrl,
    whatsappUrl,
    extraSocialLinks,
    admissionRules,
    currentNeeds: (listItem?.needs ?? []).join(", "),
    helpWays: "",
    adoptionScenario: adoptionHowto,
    adoptionQuestionnaire: "",
    adoptionRules: adoptionHowto,
    futureOwnerRequirements: "",
    organizationHistory: pickStr(about.history),
    aboutMainTasks: "",
    aboutGalleryCaption: "",
    inn: pickStr(about.inn),
    ogrn: pickStr(about.ogrn),
    bankAccount: pickStr(about.bank_account),
    coverDataUrl: cover ? getImageUrl(cover) : "",
    logoDataUrl: logo ? getImageUrl(logo) : "",
    galleryDataUrls,
  };
}

export function mergeOrganizationProfilePreferApi(
  api: OrganizationProfileData,
  local: OrganizationProfileData | null | undefined
): OrganizationProfileData {
  if (!local) return api;
  const str = (a: string, l: string) => (l.trim() ? l : a);
  const social = local.extraSocialLinks.some((r) => r.url.trim())
    ? local.extraSocialLinks
    : api.extraSocialLinks;
  const gallery =
    local.galleryDataUrls.filter((u) => (u || "").trim()).length > 0
      ? local.galleryDataUrls
      : api.galleryDataUrls;
  return {
    ...api,
    organizationName: str(api.organizationName, local.organizationName),
    description: str(api.description, local.description),
    specialization: str(api.specialization, local.specialization),
    territory: str(api.territory, local.territory),
    contacts: str(api.contacts, local.contacts),
    phone: str(api.phone, local.phone),
    email: str(api.email, local.email),
    vkUrl: str(api.vkUrl, local.vkUrl),
    telegramUrl: str(api.telegramUrl, local.telegramUrl),
    whatsappUrl: str(api.whatsappUrl, local.whatsappUrl),
    extraSocialLinks: social,
    admissionRules: str(api.admissionRules, local.admissionRules),
    currentNeeds: str(api.currentNeeds, local.currentNeeds),
    helpWays: str(api.helpWays, local.helpWays),
    adoptionScenario: str(api.adoptionScenario, local.adoptionScenario),
    adoptionQuestionnaire: str(api.adoptionQuestionnaire, local.adoptionQuestionnaire),
    adoptionRules: str(api.adoptionRules, local.adoptionRules),
    futureOwnerRequirements: str(api.futureOwnerRequirements, local.futureOwnerRequirements),
    organizationHistory: str(api.organizationHistory, local.organizationHistory),
    aboutMainTasks: str(api.aboutMainTasks, local.aboutMainTasks),
    aboutGalleryCaption: str(api.aboutGalleryCaption, local.aboutGalleryCaption),
    inn: str(api.inn, local.inn),
    ogrn: str(api.ogrn, local.ogrn),
    bankAccount: str(api.bankAccount, local.bankAccount),
    coverDataUrl: str(api.coverDataUrl, local.coverDataUrl),
    logoDataUrl: str(api.logoDataUrl, local.logoDataUrl),
    galleryDataUrls: gallery,
  };
}

export function extractOrganizationIdFromCabinetPayload(data: unknown): number | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  const fromRoot =
    parseOrganizationId(o.organization_id) ?? parseOrganizationId(o.organizationId);
  if (fromRoot != null) return fromRoot;
  const hero = o.hero;
  if (hero && typeof hero === "object") {
    const h = hero as Record<string, unknown>;
    const fromHero = parseOrganizationId(h.organization_id) ?? parseOrganizationId(h.organizationId);
    if (fromHero != null) return fromHero;
  }
  return null;
}

export function mapOrganizationPublicPageToProfileData(
  page: OrganizationPublicPage,
  listItem: OrganizationListItem | null,
  ownerName: string
): OrganizationProfileData {
  const h = page.hero;
  const a = page.about;
  const socialRows = (h.social_links ?? []).map((s) => ({
    platform: "",
    url: s.url ?? "",
    label: s.label ?? "",
  })) as unknown[];
  const { vkUrl, telegramUrl, whatsappUrl, extraSocialLinks } = socialRowsToProfileFields(socialRows);
  return {
    organizationName: (h.name || listItem?.name || ownerName).trim() || ownerName,
    description: h.description ?? "",
    specialization: (h.tagline || listItem?.specialization || "").trim(),
    territory: (h.geography_display || h.region || h.city || "").trim(),
    contacts: "",
    phone: (h.phone ?? "").trim(),
    email: (h.email ?? "").trim(),
    vkUrl,
    telegramUrl,
    whatsappUrl,
    extraSocialLinks,
    admissionRules: h.admission_rules ?? "",
    currentNeeds: (listItem?.needs ?? []).join(", "),
    helpWays: (page.help_sections ?? [])
      .map((x) => `${x.title}: ${x.description}`)
      .filter(Boolean)
      .join("\n"),
    adoptionScenario: h.adoption_howto ?? "",
    adoptionQuestionnaire: "",
    adoptionRules: h.adoption_howto ?? "",
    futureOwnerRequirements: "",
    organizationHistory: a.about ?? "",
    aboutMainTasks: "",
    aboutGalleryCaption: "",
    inn: a.inn ?? "",
    ogrn: a.ogrn ?? "",
    bankAccount: a.bank_account ?? "",
    coverDataUrl: h.cover_url ? getImageUrl(h.cover_url) : "",
    logoDataUrl: h.logo_url ? getImageUrl(h.logo_url) : "",
    galleryDataUrls: (a.gallery_urls ?? []).map((u) => getImageUrl(u)),
  };
}

export function buildOrganizationCabinetProfilePatch(profile: OrganizationProfileData): Record<string, unknown> {
  type Platform = "vk" | "telegram" | "whatsapp";
  const social_links: { platform: Platform; url: string }[] = [];
  const pushSocial = (platform: Platform, url: string) => {
    const u = url.trim();
    if (!u || social_links.length >= 3) return;
    if (social_links.some((s) => s.platform === platform)) return;
    social_links.push({ platform, url: u });
  };
  if (profile.vkUrl.trim()) pushSocial("vk", profile.vkUrl);
  if (profile.telegramUrl.trim()) pushSocial("telegram", profile.telegramUrl);
  if (profile.whatsappUrl.trim()) pushSocial("whatsapp", profile.whatsappUrl);
  for (const row of profile.extraSocialLinks) {
    const u = row.url.trim();
    if (!u || social_links.length >= 3) continue;
    const m = `${row.messenger} ${u}`.toLowerCase();
    if (m.includes("vk") || u.includes("vk.com")) pushSocial("vk", u);
    else if (m.includes("telegram") || u.includes("t.me")) pushSocial("telegram", u);
    else if (m.includes("whatsapp") || u.includes("wa.me")) pushSocial("whatsapp", u);
  }

  const trimmedGallerySlots = profile.galleryDataUrls.map((u) => u.trim()).filter(Boolean);
  const hasOnlyPendingDataUrls =
    trimmedGallerySlots.length > 0 && trimmedGallerySlots.every((u) => u.startsWith("data:"));

  const gallery = trimmedGallerySlots
    .filter((u) => !u.startsWith("data:"))
    .slice(0, 5)
    .map((url) => ({ url, description: null }));

  const about: Record<string, unknown> = {
    history: profile.organizationHistory.trim() || null,
    inn: profile.inn.trim() || null,
    ogrn: profile.ogrn.trim() || null,
    bank_account: profile.bankAccount.trim() || null,
  };
  if (gallery.length > 0) {
    about.gallery = gallery;
  } else if (!hasOnlyPendingDataUrls) {
    // Пустой массив явно сбрасывает галерею на бэке; пропуск поля оставило бы старые фото.
    // Если в форме только data: (ещё не залитые файлы) — не трогаем gallery в PATCH.
    about.gallery = [];
  }

  return {
    profile: {
      name: profile.organizationName.trim() || null,
      specialization: profile.specialization.trim() || null,
      description: profile.description.trim() || null,
      city: profile.territory.trim() || null,
    },
    contacts: {
      phone: profile.phone.trim() || null,
      email: profile.email.trim() || null,
      social_links,
    },
    about,
    instructions: {
      adoption_howto: profile.adoptionScenario.trim() || profile.adoptionRules.trim() || null,
      admission_rules: profile.admissionRules.trim() || null,
    },
  };
}

function pickNum(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function pickBool(v: unknown): boolean {
  return v === true;
}

export function mapMeOrganizationAnimalRow(
  row: Record<string, unknown>,
  orgTitle: string,
  orgId: number
): Animal {
  const id = pickNum(row.id) ?? 0;
  const primary =
    pickStr(row.primary_photo_url) ||
    pickStr(row.primary_photo) ||
    (Array.isArray(row.photo_urls) && row.photo_urls.length ? pickStr(row.photo_urls[0]) : "");
  const photos = Array.isArray(row.photo_urls)
    ? (row.photo_urls as unknown[]).map((x) => pickStr(x)).filter(Boolean)
    : primary
      ? [primary]
      : [];
  return {
    id,
    name: pickStr(row.name) || "Без имени",
    species: pickStr(row.species) || "—",
    breed: pickStr(row.breed) || null,
    sex: pickStr(row.sex) || "unknown",
    age_months: pickNum(row.age_months) ?? 0,
    location_city: pickStr(row.location_city) || null,
    is_urgent: pickBool(row.is_urgent),
    status: pickStr(row.status) || "in_shelter",
    full_description: pickStr(row.full_description) || pickStr(row.description) || null,
    primary_photo_url: primary ? getImageUrl(primary) : null,
    photo_urls: photos.map((u) => getImageUrl(u)),
    organization: { id: orgId, name: orgTitle, city: pickStr(row.location_city) || "" },
    organization_name: orgTitle,
    health_features: pickStr(row.health_features) || undefined,
    treatment_required: pickStr(row.treatment_required) || undefined,
    character_tags: Array.isArray(row.character_tags)
      ? (row.character_tags as unknown[]).map((x) => pickStr(x)).filter(Boolean)
      : [],
    health_checklist: [],
    catalog_features: [],
  };
}

export function mapMeHelpRequestToUrgentItem(
  row: Record<string, unknown>,
  organizationId: number,
  organizationName: string
): UrgentItem {
  const id = pickNum(row.id) ?? 0;
  const helpType = pickStr(row.help_type) || "manual";
  const typeGroup = pickStr(row.type_group).toLowerCase();
  const volunteerNeeded =
    typeGroup === "volunteer_task"
      ? true
      : typeGroup === "fundraising"
        ? false
        : pickBool(row.volunteer_needed) ||
          !["financial", "food", "medical", "feed"].includes(helpType.toLowerCase());
  return {
    id,
    title: pickStr(row.title) || "Заявка",
    description: pickStr(row.description) || "",
    city: pickStr(row.city) || null,
    organization_id: organizationId,
    organization_name: organizationName,
    animal_id: pickNum(row.animal_id),
    animal_name: pickStr(row.animal_name) || null,
    animal_species: pickStr(row.animal_species) || null,
    help_type: helpType,
    is_urgent: pickBool(row.is_urgent),
    volunteer_needed: volunteerNeeded,
    deadline_at: pickStr(row.deadline_at) || null,
    deadline_label: pickStr(row.deadline_label) || null,
    deadline_note: pickStr(row.deadline_note) || null,
    status: pickStr(row.status) || "open",
    target_amount: pickNum(row.target_amount),
    collected_amount: pickNum(row.collected_amount),
    primary_photo_url: pickStr(row.primary_photo_url) || pickStr(row.media_url) || null,
    badges: Array.isArray(row.badges) ? (row.badges as string[]) : [],
  };
}

export function mapMeHelpRequestToUrgentDetail(
  row: Record<string, unknown>,
  organizationId: number,
  organizationName: string
): UrgentRequestDetail {
  const base = mapMeHelpRequestToUrgentItem(row, organizationId, organizationName);
  return {
    ...base,
    address: pickStr(row.address) || null,
    latitude: pickNum(row.latitude),
    longitude: pickNum(row.longitude),
    volunteer_requirements: pickStr(row.volunteer_requirements) || null,
    volunteer_competencies: Array.isArray(row.volunteer_competencies)
      ? (row.volunteer_competencies as unknown[]).map((x) => pickStr(x)).filter(Boolean)
      : [],
    media_url: pickStr(row.media_url) || null,
    created_at: pickStr(row.created_at) || new Date().toISOString(),
    updated_at: pickStr(row.updated_at) || pickStr(row.created_at) || new Date().toISOString(),
  };
}

export function mapMeHomeStoryRow(row: Record<string, unknown>): GreetingFromHome {
  const id = pickNum(row.id) ?? 0;
  const photo = pickStr(row.photo_url);
  return {
    id,
    petName: pickStr(row.animal_name) || pickStr(row.pet_name) || "Подопечный",
    text: pickStr(row.story) || pickStr(row.text) || "",
    photoUrl: photo ? getImageUrl(photo) : undefined,
    linkedAnimalId: pickNum(row.animal_id) ?? undefined,
    createdAt: pickStr(row.adopted_at) || pickStr(row.created_at) || new Date().toISOString(),
  };
}

export function mapMeReportRow(row: Record<string, unknown>): OrganizationReport {
  const id = pickNum(row.id) ?? 0;
  const archived =
    pickBool(row.archived) ||
    String(pickStr(row.status)).toLowerCase() === "archived" ||
    String(pickStr(row.visibility)).toLowerCase() === "archived";
  return {
    id,
    title: pickStr(row.title) || "Отчёт",
    content: pickStr(row.content) || pickStr(row.summary) || pickStr(row.body) || "",
    isUrgent: pickBool(row.is_urgent),
    archived,
    createdAt: pickStr(row.created_at) || pickStr(row.published_at) || new Date().toISOString(),
  };
}

export async function fetchOrganizationMeCabinetApiPayload(
  nameHints: readonly string[]
): Promise<OrganizationCabinetApiPayload | null> {
  let profileRaw: unknown;
  try {
    profileRaw = await meOrganizationApi.getProfileCabinet();
  } catch {
    return null;
  }

  const organizationId = extractOrganizationIdFromCabinetPayload(profileRaw);
  let publicPage: OrganizationPublicPage | null = tryParseOrganizationPublicPage(profileRaw);

  if (!publicPage && organizationId != null) {
    try {
      publicPage = await organizationsApi.getById(organizationId);
    } catch {
      publicPage = null;
    }
  }

  if (!publicPage || organizationId == null) {
    return null;
  }

  let listItem: OrganizationListItem | null = null;
  try {
    const list = await organizationsApi.getList();
    listItem = (list.items ?? []).find((x) => x.id === organizationId) ?? null;
  } catch {
    listItem = null;
  }

  const title = publicPage.hero.name?.trim() || listItem?.name?.trim() || nameHints[0]?.trim() || "Организация";

  let animalsRaw: Record<string, unknown>[] = [];
  let helpRaw: Record<string, unknown>[] = [];
  let storiesRaw: Record<string, unknown>[] = [];
  let reportsRaw: Record<string, unknown>[] = [];
  let eventsRaw: Record<string, unknown>[] = [];
  let articlesRaw: Record<string, unknown>[] = [];
  try {
    const [a, h, s, r, e, ar] = await Promise.all([
      fetchOrgAnimalsAllPages().catch(() => []),
      fetchOrgHelpRequestsAllPages().catch(() => []),
      meOrganizationApi.listHomeStories().catch(() => []),
      meOrganizationApi.listReports().catch(() => []),
      meOrganizationApi.listEvents().catch(() => []),
      meOrganizationApi.listArticles().catch(() => []),
    ]);
    animalsRaw = unwrapApiList<Record<string, unknown>>(a);
    helpRaw = unwrapApiList<Record<string, unknown>>(h);
    storiesRaw = unwrapApiList<Record<string, unknown>>(s);
    reportsRaw = unwrapApiList<Record<string, unknown>>(r);
    eventsRaw = unwrapApiList<Record<string, unknown>>(e);
    articlesRaw = unwrapApiList<Record<string, unknown>>(ar);
  } catch {
  }

  const apiAnimals = animalsRaw.map((row) => mapMeOrganizationAnimalRow(row, title, organizationId));
  const apiGreetings = storiesRaw.map((row) => mapMeHomeStoryRow(row));
  const apiRequests = helpRaw.map((row) =>
    mapPublicUrgentToRequest({
      id: pickNum(row.id) ?? 0,
      title: pickStr(row.title),
      description: pickStr(row.description),
      help_type: pickStr(row.help_type) || "manual",
      is_urgent: pickBool(row.is_urgent),
      animal_id: pickNum(row.animal_id),
      volunteer_needed: pickBool(row.volunteer_needed),
    })
  );
  const apiEvents = eventsRaw.map((row) =>
    mapPublicEventToCabinet({
      id: pickNum(row.id) ?? 0,
      title: pickStr(row.title),
      starts_at: pickStr(row.starts_at) || new Date().toISOString(),
      ends_at: pickStr(row.ends_at) || null,
      description: pickStr(row.description),
      location_display: pickStr(row.location_display) || pickStr(row.city) || pickStr(row.address),
    })
  );
  const apiArticles = articlesRaw.map((row) =>
    mapPublicArticleToCabinet({
      id: pickNum(row.id) ?? 0,
      title: pickStr(row.title),
      category: pickStr(row.category) || "care",
      read_minutes: pickNum(row.read_minutes) ?? 0,
    })
  );
  const apiReports = reportsRaw.map(mapMeReportRow);

  const hint = nameHints[0]?.trim() || title;
  const mappedProfile = isOrgCabinetProfileResponse(profileRaw)
    ? mapOrgCabinetProfileResponseToProfileData(profileRaw as Record<string, unknown>, listItem, hint)
    : mapOrganizationPublicPageToProfileData(publicPage, listItem, hint);
  try {
  
    saveOrganizationProfile(mappedProfile, { skipNotify: true });
  } catch {
  }

  return {
    apiAnimals,
    apiAnimalIds: new Set(apiAnimals.map((x) => x.id)),
    apiGreetings,
    apiGreetingIds: new Set(apiGreetings.map((g) => g.id)),
    apiRequests,
    apiRequestIds: new Set(apiRequests.map((r) => r.id)),
    apiEvents,
    apiEventIds: new Set(apiEvents.map((e) => e.id)),
    apiArticles,
    apiArticleIds: new Set(apiArticles.map((a) => a.id)),
    apiReports,
    apiReportIds: new Set(apiReports.map((r) => r.id)),
    organizationId,
    publicPage,
    listItem,
    dataSource: "me",
  };
}
