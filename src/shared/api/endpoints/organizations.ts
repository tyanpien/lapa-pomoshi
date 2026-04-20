import { apiFetch, getImageUrl } from "../client";

export interface Organization {
  id: number;
  name: string;
  city: string;
  address: string;
  specialization: "cat" | "dog" | "both";
  wards_count: number;
  adopted_yearly_count: number;
  needs: string[];
  description: string;
  logo?: string | null;
}

export interface NeedOption {
  id: string;
  label: string;
}

export interface OrganizationCatalogs {
  cities: string[];
  specializations: string[];
  needs_options: NeedOption[];
}

export const organizationsApi = {
  getList: () => apiFetch('/api/v1/organizations'),
  getCatalogs: () => apiFetch('/api/v1/organizations/catalogs'),
  getById: (id: number) => apiFetch(`/api/v1/organizations/${id}`),
  getImageUrl,
};
