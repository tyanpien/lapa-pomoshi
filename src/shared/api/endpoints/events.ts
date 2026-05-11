import { apiFetch } from "../client";

export interface EventItem {
  id: number;
  title: string;
  summary: string | null;
  organization_name: string | null;
  city: string | null;
  address: string | null;
  format: string;
  help_type: string | null;
  starts_at: string;
  ends_at: string | null;
  description?: string | null;
}

export interface EventsResponse {
  total: number;
  items: EventItem[];
}

export interface EventsCatalogs {
  cities: string[];
  formats: {
    id: string;
    label: string;
  }[];
  help_types: {
    id: string;
    label: string;
  }[];
}

export const eventsApi = {
  getList: () => apiFetch("/api/v1/events") as Promise<EventsResponse>,
  getCatalogs: () => apiFetch("/api/v1/events/catalogs") as Promise<EventsCatalogs>,
  getById: (id: number) => apiFetch(`/api/v1/events/${id}`) as Promise<EventItem>,

  create: (payload: Record<string, unknown>) =>
    apiFetch("/api/v1/events", { method: "POST", body: JSON.stringify(payload ?? {}) }) as Promise<EventItem>,

  patch: (id: number, payload: Record<string, unknown>) =>
    apiFetch(`/api/v1/events/${id}`, { method: "PATCH", body: JSON.stringify(payload ?? {}) }) as Promise<EventItem>,

  delete: (id: number) => apiFetch(`/api/v1/events/${id}`, { method: "DELETE" }) as Promise<unknown>,

  archive: (id: number) => apiFetch(`/api/v1/events/${id}/archive`, { method: "POST" }) as Promise<unknown>,
};
