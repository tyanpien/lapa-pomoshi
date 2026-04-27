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
  getList: () => apiFetch('/api/v1/knowledge'),
  getCatalogs: () => apiFetch('/api/v1/knowledge/catalogs'),
  getById: (id: number) => apiFetch(`/api/v1/knowledge/${id}`),
  getImageUrl,
};
