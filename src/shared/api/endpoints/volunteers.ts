import { apiFetch, getImageUrl } from "../client";

export interface Volunteer {
  user_id: number;
  full_name: string;
  avatar_url: string | null;
  rating: number;
  location_city: string;
  experience_level: string;
  experience_level_label: string;
  completed_tasks_count: number;
  is_available: boolean;
  competency_tags: string[];
  animal_types: string[];
  travel_radius_km: number;
  availability: string;
}

export interface VolunteerDetail extends Volunteer {
  competencies: string[];
  competency_labels: string[];
  about_me: string;
  animal_type_labels: string[];
  reviews: Review[];
}

export interface Review {
  author_name: string;
  author_avatar_url: string | null;
  review_date: string;
  rating: number;
  text: string;
}

export interface CatalogOption {
  id: string;
  label: string;
}

export interface VolunteersCatalogs {
  cities: string[];
  competencies: CatalogOption[];
  experience_levels: CatalogOption[];
  animal_types: CatalogOption[];
}

export const volunteersApi = {
  getList: () => apiFetch('/api/v1/volunteers'),
  getCatalogs: () => apiFetch('/api/v1/volunteers/catalogs'),
  getById: (id: number) => apiFetch(`/api/v1/volunteers/${id}`),
  getImageUrl,
};
