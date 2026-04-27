import { apiFetch } from "../client";

export interface EventItem {
  id: number;
  title: string;
  summary: string;
  organization_name: string;
  city: string;
  address: string;
  format: "online" | "offline";
  help_type: string;
  starts_at: string;
  ends_at: string;
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
  getList: () => apiFetch('/api/v1/events'),
  getCatalogs: () => apiFetch('/api/v1/events/catalogs'),
  getById: (id: number) => apiFetch(`/api/v1/events/${id}`),
};
