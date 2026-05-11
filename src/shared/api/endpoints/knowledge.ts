import { apiFetch, getImageUrl } from "../client";

export interface KnowledgeItem {
  id: number;
  title: string;
  summary: string;
  content?: string;
  category: string;
  category_label: string;
  read_minutes: number;
  is_context_tip: boolean;
  created_at: string;
}

export interface KnowledgeListResponse {
  total: number;
  items: KnowledgeItem[];
}

export interface KnowledgeCatalogsResponse {
  categories: {
    id: string;
    label: string;
  }[];
  tip_scope_options: {
    id: string;
    label: string;
  }[];
}

export const knowledgeApi = {
  getList: () => apiFetch("/api/v1/knowledge") as Promise<KnowledgeListResponse>,
  getCatalogs: () => apiFetch("/api/v1/knowledge/catalogs") as Promise<KnowledgeCatalogsResponse>,
  getById: (id: number) => apiFetch(`/api/v1/knowledge/${id}`) as Promise<KnowledgeItem>,

  create: (payload: Record<string, unknown>) =>
    apiFetch("/api/v1/knowledge", { method: "POST", body: JSON.stringify(payload ?? {}) }) as Promise<KnowledgeItem>,

  patch: (id: number, payload: Record<string, unknown>) =>
    apiFetch(`/api/v1/knowledge/${id}`, { method: "PATCH", body: JSON.stringify(payload ?? {}) }) as Promise<KnowledgeItem>,

  delete: (id: number) => apiFetch(`/api/v1/knowledge/${id}`, { method: "DELETE" }) as Promise<unknown>,

  archive: (id: number) => apiFetch(`/api/v1/knowledge/${id}/archive`, { method: "POST" }) as Promise<unknown>,
  getImageUrl,
};
