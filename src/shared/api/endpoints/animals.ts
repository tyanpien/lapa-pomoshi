import { apiFetch, getImageUrl } from "../client";

export interface Animal {
  id: number;
  name: string;
  species: string;
  breed?: string | null;
  sex?: string;
  age_months: number;
  location_city: string | null;
  is_urgent: boolean;
  status: string;
  full_description?: string | null;
  primary_photo_url: string | null;
  photo_urls?: string[];
  organization?: {
    id: number;
    name: string;
    city: string;
  } | null;
  health_checklist?: string[];
  health_care_slugs?: string[];
  health_care_other?: string | null;
  health_features?: string;
  treatment_required?: string;
  character_tags?: string[];
  character_slugs?: string[];
  character_other?: string | null;
  organization_name?: string;
  catalog_features?: string[];
  created_at?: string;
}

export type AnimalPhotoUploadResponse = {
  id: number;
  animal_id: number;
  is_primary: boolean;
  url: string;
};

function animalsQuery(filters?: Record<string, string | number | boolean | undefined | null>): string {
  const q = new URLSearchParams();
  if (!filters) {
    const s = q.toString();
    return s ? `?${s}` : "";
  }
  for (const [key, raw] of Object.entries(filters)) {
    if (raw === undefined || raw === null || raw === "") continue;
    q.set(key, String(raw));
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

export const animalsApi = {
  getList: (filters?: Record<string, string | number | boolean | undefined | null>) =>
    apiFetch(`/api/v1/animals${animalsQuery(filters)}`),
  getById: (id: number) => apiFetch(`/api/v1/animals/${id}`),
  getCatalogs: () => apiFetch("/api/v1/animals/catalogs"),
  getImageUrl,

  uploadImage: (animalId: number, file: File, isPrimary?: boolean) => {
    const fd = new FormData();
    fd.append("file", file);
    const q = typeof isPrimary === "boolean" ? `?is_primary=${isPrimary ? "true" : "false"}` : "";
    return apiFetch(`/api/v1/animals/${animalId}/images${q}`, {
      method: "POST",
      body: fd,
    }) as Promise<AnimalPhotoUploadResponse>;
  },
};
