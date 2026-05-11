import type { Animal } from "@/shared/api/endpoints/animals";
import { getImageUrl } from "@/shared/api/client";
import type {
  OrgPublicArticle,
  OrgPublicEvent,
  OrgPublicHomeStory,
  OrgPublicReport,
  OrgPublicUrgentNeed,
  OrgPublicWardCard,
  OrganizationListItem,
  OrganizationPublicPage,
} from "@/shared/api/endpoints/organizations";
import { organizationsApi } from "@/shared/api/endpoints/organizations";
import type {
  GreetingFromHome,
  OrganizationArticle,
  OrganizationEvent,
  OrganizationReport,
  OrganizationRequest,
} from "@/shared/lib/organizationCabinet";

export type ResolvedOrganizationPublic = {
  organizationId: number;
  page: OrganizationPublicPage;
  listItem: OrganizationListItem;
};

export async function resolveOrganizationPublicByNameHints(
  nameHints: readonly string[]
): Promise<ResolvedOrganizationPublic | null> {
  const normalized = [...new Set(nameHints.map((h) => h.trim().toLowerCase()).filter(Boolean))];
  if (!normalized.length) return null;
  try {
    const { items } = await organizationsApi.getList();
    const item = items.find((o) => normalized.includes(o.name.trim().toLowerCase())) ?? null;
    if (!item) return null;
    const page = await organizationsApi.getById(item.id);
    return { organizationId: item.id, page, listItem: item };
  } catch {
    return null;
  }
}

export function mapOrgPublicWardToAnimal(w: OrgPublicWardCard, orgTitle: string, orgId: number): Animal {
  const photo = w.photo_url ? getImageUrl(w.photo_url) : null;
  return {
    id: w.id,
    name: w.name,
    species: w.species,
    breed: w.species,
    sex: "unknown",
    age_months: w.age_months,
    location_city: null,
    is_urgent: w.is_urgent,
    status: w.status,
    full_description: "",
    primary_photo_url: photo,
    photo_urls: photo ? [photo] : [],
    organization: { id: orgId, name: orgTitle, city: "" },
    organization_name: orgTitle,
    health_features: "",
    treatment_required: "",
    character_tags: [],
    health_checklist: [],
    catalog_features: [],
  };
}

export function mapPublicHomeStoryToGreeting(s: OrgPublicHomeStory): GreetingFromHome {
  return {
    id: s.id,
    petName: s.animal_name,
    text: s.story,
    photoUrl: s.photo_url ? getImageUrl(s.photo_url) : undefined,
    linkedAnimalId: undefined,
    createdAt: s.adopted_at,
  };
}

export function mapPublicUrgentToRequest(u: OrgPublicUrgentNeed): OrganizationRequest {
  return {
    id: u.id,
    title: u.title,
    location: "",
    problemDescription: u.description,
    helpType: u.help_type,
    urgency: u.is_urgent ? "urgent" : "normal",
    linkedAnimalId: u.animal_id ?? undefined,
    needVolunteer: u.volunteer_needed,
    volunteerCompetencies: "",
    status: "published",
    createdAt: new Date().toISOString(),
  };
}

export function mapPublicEventToCabinet(e: OrgPublicEvent): OrganizationEvent {
  return {
    id: e.id,
    title: e.title,
    description: e.description,
    location: e.location_display || "",
    dateLabel: new Date(e.starts_at).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
    archived: false,
    createdAt: e.starts_at,
  };
}

export function mapPublicArticleToCabinet(a: OrgPublicArticle): OrganizationArticle {
  return {
    id: a.id,
    title: a.title,
    articleType: a.category,
    author: "",
    content: "",
    archived: false,
    createdAt: new Date().toISOString(),
  };
}

export function mapPublicReportToCabinet(r: OrgPublicReport): OrganizationReport {
  return {
    id: r.id,
    title: r.title,
    content: r.summary || "",
    isUrgent: false,
    archived: false,
    createdAt: r.published_at,
  };
}

export function mergeApiFirstById<T extends { id: number }>(apiItems: T[], localItems: T[]): T[] {
  const seen = new Set<number>();
  const out: T[] = [];
  for (const x of apiItems) {
    if (seen.has(x.id)) continue;
    seen.add(x.id);
    out.push(x);
  }
  for (const x of localItems) {
    if (seen.has(x.id)) continue;
    seen.add(x.id);
    out.push(x);
  }
  return out;
}

export function statsFromOrganizationPublicPage(
  page: OrganizationPublicPage,
  listFallback: { wards_count: number; adopted_yearly_count: number }
): { wards: number; adopted: number } {
  const wardsLen = (page.wards ?? []).length;
  const wards = wardsLen || page.hero.wards_count || listFallback.wards_count || 0;

  const storiesLen = (page.home_stories ?? []).length;
  const adopted =
    storiesLen || page.hero.adopted_yearly_count || listFallback.adopted_yearly_count || 0;

  return { wards, adopted };
}

export type OrganizationCabinetApiPayload = {
  apiAnimals: Animal[];
  apiAnimalIds: Set<number>;
  apiGreetings: GreetingFromHome[];
  apiGreetingIds: Set<number>;
  apiRequests: OrganizationRequest[];
  apiRequestIds: Set<number>;
  apiEvents: OrganizationEvent[];
  apiEventIds: Set<number>;
  apiArticles: OrganizationArticle[];
  apiArticleIds: Set<number>;
  apiReports: OrganizationReport[];
  apiReportIds: Set<number>;
  organizationId: number | null;
  publicPage: OrganizationPublicPage | null;
  listItem: OrganizationListItem | null;
};

export function emptyOrganizationCabinetApiPayload(): OrganizationCabinetApiPayload {
  return {
    apiAnimals: [],
    apiAnimalIds: new Set(),
    apiGreetings: [],
    apiGreetingIds: new Set(),
    apiRequests: [],
    apiRequestIds: new Set(),
    apiEvents: [],
    apiEventIds: new Set(),
    apiArticles: [],
    apiArticleIds: new Set(),
    apiReports: [],
    apiReportIds: new Set(),
    organizationId: null,
    publicPage: null,
    listItem: null,
  };
}

export async function fetchOrganizationCabinetApiPayload(
  nameHints: readonly string[]
): Promise<OrganizationCabinetApiPayload> {
  const resolved = await resolveOrganizationPublicByNameHints(nameHints);
  if (!resolved) return emptyOrganizationCabinetApiPayload();

  const { page, organizationId, listItem } = resolved;
  const title = page.hero.name?.trim() || "";

  const apiAnimals = (page.wards ?? []).map((w) => mapOrgPublicWardToAnimal(w, title, organizationId));
  const apiGreetings = (page.home_stories ?? []).map(mapPublicHomeStoryToGreeting);
  const apiRequests = (page.urgent_help ?? []).map(mapPublicUrgentToRequest);
  const apiEvents = (page.events ?? []).map(mapPublicEventToCabinet);
  const apiArticles = (page.articles ?? []).map(mapPublicArticleToCabinet);
  const apiReports = (page.reports ?? []).map(mapPublicReportToCabinet);

  return {
    apiAnimals,
    apiAnimalIds: new Set(apiAnimals.map((a) => a.id)),
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
    publicPage: page,
    listItem,
  };
}
