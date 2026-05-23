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
  author_user_id?: number | null;
  can_edit?: boolean;
  is_published?: boolean;
  is_archived?: boolean;
}

export interface KnowledgeMineListResponse {
  total: number;
  items: KnowledgeItem[];
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

export type KnowledgeListParams = {
  q?: string;
  category?: string;
  only_context_tips?: boolean;
  limit?: number;
  offset?: number;
};

export const knowledgeApi = {
  getList: (params?: KnowledgeListParams) => {
    const q = new URLSearchParams();
    if (params?.q?.trim()) q.set("q", params.q.trim());
    if (params?.category?.trim()) q.set("category", params.category.trim());
    if (params?.only_context_tips === true) q.set("only_context_tips", "true");
    if (typeof params?.limit === "number") q.set("limit", String(params.limit));
    if (typeof params?.offset === "number") q.set("offset", String(params.offset));
    const qs = q.toString();
    return apiFetch(`/api/v1/knowledge${qs ? `?${qs}` : ""}`) as Promise<KnowledgeListResponse>;
  },
  listMine: () => apiFetch("/api/v1/knowledge/mine") as Promise<KnowledgeMineListResponse>,
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
