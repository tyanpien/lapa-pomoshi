import { apiFetch, getImageUrl } from "../client";

export interface Animal {
  id: number;
  name: string;
  species: string;
  breed: string;
  sex: string;
  age_months: number;
  location_city: string | null;
  is_urgent: boolean;
  status: string;
  full_description: string;
  primary_photo_url: string | null;
  photo_urls: string[];
  organization: {
    id: number;
    name: string;
    city: string;
  } | null;
  health_checklist?: string[];
  health_features?: string;
  treatment_required?: string;
  character_tags?: string[];
  organization_name?: string;
  catalog_features?: string[];
}

export const animalsApi = {
  getList: () => apiFetch('/api/v1/animals'),
  getById: (id: number) => apiFetch(`/api/v1/animals/${id}`),
  getCatalogs: () => apiFetch('/api/v1/animals/catalogs'),
  getImageUrl,
};
