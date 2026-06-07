import { apiFetch, getImageUrl } from "../client";

export interface KnowledgeItem {
  id: number;
  title: string;
  summary: string;
  content?: string;
  cover_url?: string | null;
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

export interface KnowledgeHintItem {
  id: number;
  title: string;
  summary: string | null;
  cover_url?: string | null;
  category: string;
  category_label: string | null;
  read_minutes: number;
  match_score: number;
  match_reasons: string[];
}

export interface KnowledgeHintsResponse {
  total: number;
  items: KnowledgeHintItem[];
}

export type KnowledgeHintParams = {
  help_type?: string | null;
  animal_species?: string | null;
  competency_slugs?: string[];
  keywords?: string[];
  task_text?: string | null;
  limit?: number;
};

function fdSingle(file: File, fieldName: string) {
  const fd = new FormData();
  fd.append(fieldName, file);
  return fd;
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

  getHints: (params?: KnowledgeHintParams) => {
    const q = new URLSearchParams();
    if (params?.help_type?.trim()) q.set("help_type", params.help_type.trim());
    if (params?.animal_species?.trim()) q.set("animal_species", params.animal_species.trim());
    if (params?.competency_slugs?.length) q.set("competency_slugs", params.competency_slugs.join(","));
    if (params?.keywords?.length) q.set("keywords", params.keywords.join(","));
    if (params?.task_text?.trim()) q.set("task_text", params.task_text.trim());
    if (typeof params?.limit === "number") q.set("limit", String(params.limit));
    const qs = q.toString();
    return apiFetch(`/api/v1/knowledge/hints${qs ? `?${qs}` : ""}`, {
      cache: "no-store",
    }) as Promise<KnowledgeHintsResponse>;
  },

  getById: (id: number) => apiFetch(`/api/v1/knowledge/${id}`) as Promise<KnowledgeItem>,

  create: (payload: Record<string, unknown>) =>
    apiFetch("/api/v1/knowledge", { method: "POST", body: JSON.stringify(payload ?? {}) }) as Promise<KnowledgeItem>,

  patch: (id: number, payload: Record<string, unknown>) =>
    apiFetch(`/api/v1/knowledge/${id}`, { method: "PATCH", body: JSON.stringify(payload ?? {}) }) as Promise<KnowledgeItem>,

  delete: (id: number) => apiFetch(`/api/v1/knowledge/${id}`, { method: "DELETE" }) as Promise<unknown>,

  archive: (id: number) => apiFetch(`/api/v1/knowledge/${id}/archive`, { method: "POST" }) as Promise<unknown>,

  uploadCover: (id: number, file: File) =>
    apiFetch(`/api/v1/knowledge/${id}/cover`, {
      method: "POST",
      body: fdSingle(file, "file"),
    }) as Promise<KnowledgeItem>,

  getImageUrl,
};
