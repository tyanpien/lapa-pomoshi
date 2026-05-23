import { apiFetch } from "../client";

export interface UrgentItem {
  id: number;
  title: string;
  description: string;
  city: string | null;
  organization_id?: number;
  organization_name: string;

  animal_id: number | null;
  animal_name: string | null;
  animal_species: string | null;

  help_type: string;
  is_urgent: boolean;
  volunteer_needed: boolean;

  deadline_at: string | null;
  deadline_label: string | null | undefined;
  deadline_note?: string | null;

  status: string;

  target_amount: number | null;
  collected_amount?: number | null;

  primary_photo_url: string | null;

  badges: string[];
}

export interface UrgentResponse {
  total: number;
  items: UrgentItem[];
}

export interface UrgentCatalogs {
  cities: string[];
  species: {
    id: string;
    label: string;
  }[];
  help_types: {
    id: string;
    label: string;
  }[];
  volunteer_task_types?: {
    id: string;
    label: string;
  }[];
  statuses: {
    id: string;
    label: string;
  }[];
}

export interface UrgentRequestDetail extends UrgentItem {
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  volunteer_requirements: string | null;
  volunteer_competencies: string[];
  media_url: string | null;
  created_at: string;
  updated_at: string;
}

export type UrgentRequestCreatePayload = {
  animal_id?: number | null;
  title: string;
  description: string;
  city?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  help_type: string;
  is_urgent?: boolean;
  volunteer_needed?: boolean;
  volunteer_requirements?: string | null;
  volunteer_competencies?: string[];
  target_amount?: number | null;
  deadline_at?: string | null;
  deadline_note?: string | null;
  media_path?: string | null;
  status?: string;
  is_published?: boolean;
};

export type UrgentRequestUpdatePayload = {
  animal_id?: number | null;
  title?: string | null;
  description?: string | null;
  city?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  help_type?: string | null;
  is_urgent?: boolean | null;
  volunteer_needed?: boolean | null;
  volunteer_requirements?: string | null;
  volunteer_competencies?: string[] | null;
  target_amount?: number | null;
  deadline_at?: string | null;
  deadline_note?: string | null;
  media_path?: string | null;
  status?: string | null;
  is_published?: boolean | null;
};

function urgentListQuery(filters?: {
  q?: string | null;
  city?: string | null;
  animal_species?: string | null;
  help_types?: string[];
  limit?: number;
  offset?: number;
  sort_by?: string | null;
}): string {
  const q = new URLSearchParams();
  if (!filters) {
    const s = q.toString();
    return s ? `?${s}` : "";
  }
  if (filters.q?.trim()) q.set("q", filters.q.trim());
  if (filters.city?.trim()) q.set("city", filters.city.trim());
  if (filters.animal_species?.trim()) q.set("animal_species", filters.animal_species.trim());
  if (filters.help_types && filters.help_types.length > 0) {
    q.set("help_types", filters.help_types.join(","));
  }
  if (filters.limit != null) q.set("limit", String(filters.limit));
  if (filters.offset != null) q.set("offset", String(filters.offset));
  if (filters.sort_by?.trim()) q.set("sort_by", filters.sort_by.trim());
  const s = q.toString();
  return s ? `?${s}` : "";
}

export const urgentApi = {
  getList: (filters?: {
    q?: string | null;
    city?: string | null;
    animal_species?: string | null;
    help_types?: string[];
    limit?: number;
    offset?: number;
    sort_by?: string | null;
  }) => apiFetch(`/api/v1/urgent${urgentListQuery(filters ?? undefined)}`) as Promise<UrgentResponse>,

  getVolunteerTasksList: (filters?: {
    q?: string | null;
    city?: string | null;
    animal_species?: string | null;
    help_types?: string[];
    limit?: number;
    offset?: number;
  }) => {
    const q = new URLSearchParams();
    if (filters?.q?.trim()) q.set("q", filters.q.trim());
    if (filters?.city?.trim()) q.set("city", filters.city.trim());
    if (filters?.animal_species?.trim()) q.set("animal_species", filters.animal_species.trim());
    if (filters?.help_types && filters.help_types.length > 0) {
      q.set("help_types", filters.help_types.join(","));
    }
    if (filters?.limit != null) q.set("limit", String(filters.limit));
    if (filters?.offset != null) q.set("offset", String(filters.offset));
    const s = q.toString();
    return apiFetch(`/api/v1/urgent/volunteer-tasks${s ? `?${s}` : ""}`) as Promise<UrgentResponse>;
  },

  getCatalogs: () => apiFetch("/api/v1/urgent/catalogs") as Promise<UrgentCatalogs>,

  getById: (id: number) => apiFetch(`/api/v1/urgent/${id}`) as Promise<UrgentRequestDetail>,

  create: (payload: UrgentRequestCreatePayload) =>
    apiFetch("/api/v1/urgent", {
      method: "POST",
      body: JSON.stringify(payload ?? {}),
    }) as Promise<UrgentRequestDetail>,

  patch: (requestId: number, payload: UrgentRequestUpdatePayload) =>
    apiFetch(`/api/v1/urgent/${requestId}`, {
      method: "PATCH",
      body: JSON.stringify(payload ?? {}),
    }) as Promise<UrgentRequestDetail>,

  close: (requestId: number) =>
    apiFetch(`/api/v1/urgent/${requestId}/close`, { method: "POST" }) as Promise<UrgentRequestDetail>,
};

export async function fetchUrgentItemsAllPages(filters?: {
  q?: string | null;
  city?: string | null;
  animal_species?: string | null;
  help_types?: string[];
  sort_by?: string | null;
}): Promise<UrgentItem[]> {
  const acc: UrgentItem[] = [];
  let offset = 0;
  const limit = 100;
  for (;;) {
    const res = await urgentApi.getList({ ...(filters ?? {}), limit, offset });
    const batch = res.items ?? [];
    acc.push(...batch);
    if (batch.length < limit) break;
    if (typeof res.total === "number" && acc.length >= res.total) break;
    offset += limit;
    if (offset > 5000) break;
  }
  return acc;
}

export async function fetchVolunteerTasksAllPages(filters?: {
  q?: string | null;
  city?: string | null;
  animal_species?: string | null;
  help_types?: string[];
}): Promise<UrgentItem[]> {
  const acc: UrgentItem[] = [];
  let offset = 0;
  const limit = 100;
  for (;;) {
    const res = await urgentApi.getVolunteerTasksList({ ...(filters ?? {}), limit, offset });
    const batch = res.items ?? [];
    acc.push(...batch);
    if (batch.length < limit) break;
    if (typeof res.total === "number" && acc.length >= res.total) break;
    offset += limit;
    if (offset > 5000) break;
  }
  return acc;
}
