import { apiFetch } from "../client";

export interface UrgentItem {
  id: number;
  title: string;
  description: string;
  city: string;
  organization_name: string;

  animal_id: number | null;
  animal_name: string | null;
  animal_species: "cat" | "dog" | null;

  help_type: string;
  is_urgent: boolean;
  volunteer_needed: boolean;

  deadline_at: string | null;
  deadline_label: string | null;

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
  statuses: {
    id: string;
    label: string;
  }[];
}

export const urgentApi = {
  getList: () => apiFetch("/api/v1/urgent"),
  getCatalogs: () => apiFetch("/api/v1/urgent/catalogs"),
  getById: (id: number) => apiFetch(`/api/v1/urgent/${id}`),
};
