import { apiFetch } from "../client";
import type { KnowledgeHintItem } from "./knowledge";
import type { UrgentItem } from "./urgent";

export interface VolunteerTaskFeedItem extends UrgentItem {
  match_score: number;
  match_reasons: string[];
  match_reason_labels: string[];
  distance_km: number | null;
  required_competencies: string[];
  knowledge_hints: KnowledgeHintItem[];
}

export interface VolunteerTaskFeedResponse {
  total: number;
  items: VolunteerTaskFeedItem[];
  is_available: boolean;
  completed_tasks_count: number;
  message: string | null;
}

export const meVolunteerTaskFeedApi = {
  getList: (filters?: { q?: string | null; limit?: number; offset?: number }) => {
    const q = new URLSearchParams();
    if (filters?.q?.trim()) q.set("q", filters.q.trim());
    if (filters?.limit != null) q.set("limit", String(filters.limit));
    if (filters?.offset != null) q.set("offset", String(filters.offset));
    const qs = q.toString();
    return apiFetch(`/api/v1/me/volunteer/task-feed${qs ? `?${qs}` : ""}`, {
      cache: "no-store",
    }) as Promise<VolunteerTaskFeedResponse>;
  },
};

export async function fetchVolunteerTaskFeedAllPages(filters?: {
  q?: string | null;
}): Promise<VolunteerTaskFeedResponse> {
  const acc: VolunteerTaskFeedItem[] = [];
  let offset = 0;
  const limit = 100;
  let meta: Pick<VolunteerTaskFeedResponse, "is_available" | "completed_tasks_count" | "message"> = {
    is_available: true,
    completed_tasks_count: 0,
    message: null,
  };

  for (;;) {
    const res = await meVolunteerTaskFeedApi.getList({ ...(filters ?? {}), limit, offset });
    meta = {
      is_available: res.is_available,
      completed_tasks_count: res.completed_tasks_count,
      message: res.message,
    };
    const batch = res.items ?? [];
    acc.push(...batch);
    if (batch.length < limit) break;
    if (typeof res.total === "number" && acc.length >= res.total) break;
    offset += limit;
    if (offset > 5000) break;
  }

  return {
    total: acc.length,
    items: acc,
    ...meta,
  };
}
