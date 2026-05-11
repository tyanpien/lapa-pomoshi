import { apiFetch } from "../client";

export type VolunteerResponseStatus = string;

export type VolunteerResponseCardDto = {
  id: number;
  status: VolunteerResponseStatus;
  status_label?: string | null;
  report_awaiting_org_review?: boolean;
  help_request_id: number;
  title: string;
  description_snippet: string;
  organization_id: number | null;
  organization_name: string | null;
  city: string | null;
  help_type: string;
  help_type_label?: string | null;
  is_urgent: boolean;
  volunteer_needed: boolean;
  deadline_at: string | null;
  deadline_label: string | null;
  created_at: string;
  updated_at?: string | null;
  can_chat?: boolean;
  can_cancel_response?: boolean;
  can_send_report?: boolean;
  can_view_report?: boolean;
};

export type VolunteerResponseDetailDto = VolunteerResponseCardDto & {
  message: string | null;
  help_request_description: string;
};

export type MeVolunteerResponsesListResponse = {
  total: number;
  items: VolunteerResponseCardDto[];
};

export type VolunteerReportOut = {
  id: number;
  volunteer_help_response_id: number;
  content: string;
  submitted_at: string;
  org_accepted_at: string | null;
  org_rejection_reason: string | null;
};

function listQuery(params?: {
  q?: string | null;
  tab?: "all" | "pending" | "in_progress" | "completed" | "archive";
  limit?: number;
  offset?: number;
}): string {
  const q = new URLSearchParams();
  if (params?.q?.trim()) q.set("q", params.q.trim());
  if (params?.tab) q.set("tab", params.tab);
  if (params?.limit != null) q.set("limit", String(params.limit));
  if (params?.offset != null) q.set("offset", String(params.offset));
  const s = q.toString();
  return s ? `?${s}` : "";
}

export const meVolunteerResponsesApi = {
  getList: (params?: {
    q?: string | null;
    tab?: "all" | "pending" | "in_progress" | "completed" | "archive";
    limit?: number;
    offset?: number;
  }) =>
    apiFetch(`/api/v1/me/volunteer/responses${listQuery(params)}`) as Promise<MeVolunteerResponsesListResponse>,

  create: (payload: { help_request_id: number; message?: string | null }) =>
    apiFetch("/api/v1/me/volunteer/responses", {
      method: "POST",
      body: JSON.stringify(payload ?? {}),
    }) as Promise<VolunteerResponseDetailDto>,

  getById: (responseId: number) =>
    apiFetch(`/api/v1/me/volunteer/responses/${responseId}`) as Promise<VolunteerResponseDetailDto>,

  patch: (responseId: number, payload: { message?: string | null }) =>
    apiFetch(`/api/v1/me/volunteer/responses/${responseId}`, {
      method: "PATCH",
      body: JSON.stringify(payload ?? {}),
    }) as Promise<VolunteerResponseDetailDto>,

  cancel: (responseId: number) =>
    apiFetch(`/api/v1/me/volunteer/responses/${responseId}/cancel`, { method: "POST" }) as Promise<unknown>,

  getReport: (responseId: number) =>
    apiFetch(`/api/v1/me/volunteer/responses/${responseId}/report`) as Promise<VolunteerReportOut | null>,

  submitReport: (responseId: number, payload: { content: string }) =>
    apiFetch(`/api/v1/me/volunteer/responses/${responseId}/report`, {
      method: "POST",
      body: JSON.stringify(payload ?? {}),
    }) as Promise<unknown>,
};
