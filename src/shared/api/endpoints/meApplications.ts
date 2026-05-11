import { apiFetch, getImageUrl } from "../client";

export interface AdoptionApplicationListItem {
  id: number;
  status: string;
  status_label: string;
  animal_id: number;
  animal_name: string;
  species_label: string;
  breed: string | null;
  age_label: string;
  primary_photo_url: string | null;
  organization_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdoptionApplicationDetail extends AdoptionApplicationListItem {
  message: string | null;
}

export interface AdoptionApplicationListResponse {
  total: number;
  items: AdoptionApplicationListItem[];
}

function applicationsQuery(params?: { q?: string; limit?: number; offset?: number }): string {
  const q = new URLSearchParams();
  if (params?.q?.trim()) q.set("q", params.q.trim());
  if (params?.limit != null) q.set("limit", String(params.limit));
  if (params?.offset != null) q.set("offset", String(params.offset));
  const s = q.toString();
  return s ? `?${s}` : "";
}

export const meApplicationsApi = {
  getImageUrl,

  list: (params?: { q?: string; limit?: number; offset?: number }) =>
    apiFetch(`/api/v1/me/applications${applicationsQuery(params)}`) as Promise<AdoptionApplicationListResponse>,

  create: (payload: { animal_id: number; message?: string | null }) =>
    apiFetch("/api/v1/me/applications", {
      method: "POST",
      body: JSON.stringify(payload ?? {}),
    }) as Promise<AdoptionApplicationDetail>,

  getById: (applicationId: number) =>
    apiFetch(`/api/v1/me/applications/${applicationId}`) as Promise<AdoptionApplicationDetail>,

  patch: (applicationId: number, payload: { message?: string | null }) =>
    apiFetch(`/api/v1/me/applications/${applicationId}`, {
      method: "PATCH",
      body: JSON.stringify(payload ?? {}),
    }) as Promise<AdoptionApplicationDetail>,

  delete: (applicationId: number) =>
    apiFetch(`/api/v1/me/applications/${applicationId}`, { method: "DELETE" }) as Promise<unknown>,
};
