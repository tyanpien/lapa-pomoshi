import { apiFetch } from "../client";

const BASE = "/api/v1/me/organization";

function fdSingle(file: File, fieldName: string) {
  const fd = new FormData();
  fd.append(fieldName, file);
  return fd;
}

export const meOrganizationApi = {
  listDialogs: (params?: { limit?: number; offset?: number }) => {
    const q = new URLSearchParams();
    const limit = Math.min(100, Math.max(1, params?.limit ?? 100));
    q.set("limit", String(limit));
    q.set("offset", String(params?.offset ?? 0));
    return apiFetch(`${BASE}/communications/dialogs?${q.toString()}`);
  },
  openDialog: (payload: {
    participant_user_id: number;
    context_type?: string | null;
    context_entity_id?: number | null;
    context_title?: string | null;
  }) =>
    apiFetch(`${BASE}/communications/dialogs`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  openVolunteerDialog: (
    participantUserId: number,
    context?: { context_title?: string; participant_name?: string }
  ) =>
    apiFetch(`${BASE}/communications/dialogs`, {
      method: "POST",
      body: JSON.stringify({
        participant_user_id: participantUserId,
        context_type: "volunteer_direct",
        context_title:
          context?.context_title?.trim() ||
          (context?.participant_name?.trim()
            ? `Переписка: ${context.participant_name.trim()}`
            : "Переписка с волонтёром"),
      }),
    }),
  openUserDialog: (
    participantUserId: number,
    context?: { context_title?: string; participant_name?: string; context_entity_id?: number }
  ) =>
    apiFetch(`${BASE}/communications/dialogs`, {
      method: "POST",
      body: JSON.stringify({
        participant_user_id: participantUserId,
        context_type: "user_direct",
        context_title:
          context?.context_title?.trim() ||
          (context?.participant_name?.trim()
            ? `Переписка: ${context.participant_name.trim()}`
            : "Переписка с пользователем"),
        ...(context?.context_entity_id != null ? { context_entity_id: context.context_entity_id } : {}),
      }),
    }),
  openIncomingAdoptionDialog: (applicationId: number) =>
    apiFetch(`${BASE}/incoming/adoptions/${applicationId}/dialog`, {
      method: "POST",
    }),
  openIncomingVolunteerResponseDialog: (responseId: number) =>
    apiFetch(`${BASE}/incoming/volunteer-responses/${responseId}/dialog`, {
      method: "POST",
    }),
  getDialog: (dialogId: number) => apiFetch(`${BASE}/communications/dialogs/${dialogId}`),
  postDialogMessage: (dialogId: number, text: string, image?: File | null) => {
    const fd = new FormData();
    fd.append("body", text);
    if (image) fd.append("image", image);
    return apiFetch(`${BASE}/communications/dialogs/${dialogId}/messages`, {
      method: "POST",
      body: fd,
    });
  },

  getProfileCabinet: () => apiFetch(`${BASE}/profile`),
  patchProfileCabinet: (body: Record<string, unknown>) =>
    apiFetch(`${BASE}/profile`, { method: "PATCH", body: JSON.stringify(body ?? {}) }),
  getProfilePreview: () => apiFetch(`${BASE}/profile/preview`),
  uploadLogo: (file: File) =>
    apiFetch(`${BASE}/profile/logo`, { method: "POST", body: fdSingle(file, "file") }),
  uploadCover: (file: File) =>
    apiFetch(`${BASE}/profile/cover`, { method: "POST", body: fdSingle(file, "file") }),
  uploadGalleryImage: (file: File) =>
    apiFetch(`${BASE}/profile/gallery`, { method: "POST", body: fdSingle(file, "file") }),

  listAnimals: (params?: { q?: string; limit?: number; offset?: number }) => {
    const q = new URLSearchParams();
    const limit = Math.min(100, Math.max(1, params?.limit ?? 100));
    q.set("limit", String(limit));
    q.set("offset", String(params?.offset ?? 0));
    if (params?.q?.trim()) q.set("q", params.q.trim());
    return apiFetch(`${BASE}/animals?${q.toString()}`);
  },
  createAnimal: (body: Record<string, unknown>) =>
    apiFetch(`${BASE}/animals`, { method: "POST", body: JSON.stringify(body ?? {}) }),
  patchAnimal: (animalId: number, body: Record<string, unknown>) =>
    apiFetch(`${BASE}/animals/${animalId}`, { method: "PATCH", body: JSON.stringify(body ?? {}) }),
  archiveAnimal: (animalId: number) =>
    apiFetch(`${BASE}/animals/${animalId}/archive`, { method: "POST" }),

  listIncomingAdoptions: () => apiFetch(`${BASE}/incoming/adoptions`),
  getIncomingAdoption: (applicationId: number) => apiFetch(`${BASE}/incoming/adoptions/${applicationId}`),
  approveIncomingAdoption: (applicationId: number, body?: Record<string, unknown>) =>
    apiFetch(`${BASE}/incoming/adoptions/${applicationId}/approve`, {
      method: "POST",
      body: JSON.stringify(body ?? {}),
    }),
  rejectIncomingAdoption: (applicationId: number, body?: Record<string, unknown>) =>
    apiFetch(`${BASE}/incoming/adoptions/${applicationId}/reject`, {
      method: "POST",
      body: JSON.stringify(body ?? {}),
    }),

  listIncomingVolunteerResponses: () => apiFetch(`${BASE}/incoming/volunteer-responses`),
  getIncomingVolunteerResponse: (responseId: number) =>
    apiFetch(`${BASE}/incoming/volunteer-responses/${responseId}`),
  acceptVolunteerResponse: (responseId: number, body?: Record<string, unknown>) =>
    apiFetch(`${BASE}/incoming/volunteer-responses/${responseId}/accept`, {
      method: "POST",
      body: JSON.stringify(body ?? {}),
    }),
  rejectVolunteerResponse: (responseId: number, body?: Record<string, unknown>) =>
    apiFetch(`${BASE}/incoming/volunteer-responses/${responseId}/reject`, {
      method: "POST",
      body: JSON.stringify(body ?? {}),
    }),

  listHelpRequests: (params?: { q?: string; tab?: string; limit?: number; offset?: number }) => {
    const q = new URLSearchParams();
    q.set("tab", params?.tab ?? "all");
    const limit = Math.min(100, Math.max(1, params?.limit ?? 100));
    q.set("limit", String(limit));
    q.set("offset", String(params?.offset ?? 0));
    if (params?.q?.trim()) q.set("q", params.q.trim());
    return apiFetch(`${BASE}/help-requests?${q.toString()}`);
  },
  createHelpRequest: (body: Record<string, unknown>) =>
    apiFetch(`${BASE}/help-requests`, { method: "POST", body: JSON.stringify(body ?? {}) }),
  patchHelpRequest: (requestId: number, body: Record<string, unknown>) =>
    apiFetch(`${BASE}/help-requests/${requestId}`, { method: "PATCH", body: JSON.stringify(body ?? {}) }),
  closeHelpRequest: (requestId: number) =>
    apiFetch(`${BASE}/help-requests/${requestId}/close`, { method: "POST" }),

  listReports: () => apiFetch(`${BASE}/reports`),
  createReport: (body: Record<string, unknown>) =>
    apiFetch(`${BASE}/reports`, { method: "POST", body: JSON.stringify(body ?? {}) }),
  patchReport: (reportId: number, body: Record<string, unknown>) =>
    apiFetch(`${BASE}/reports/${reportId}`, { method: "PATCH", body: JSON.stringify(body ?? {}) }),
  deleteReport: (reportId: number) => apiFetch(`${BASE}/reports/${reportId}`, { method: "DELETE" }),

  listHomeStories: () => apiFetch(`${BASE}/home-stories`),
  createHomeStory: (body: Record<string, unknown>) =>
    apiFetch(`${BASE}/home-stories`, { method: "POST", body: JSON.stringify(body ?? {}) }),
  patchHomeStory: (storyId: number, body: Record<string, unknown>) =>
    apiFetch(`${BASE}/home-stories/${storyId}`, { method: "PATCH", body: JSON.stringify(body ?? {}) }),
  uploadHomeStoryPhoto: (storyId: number, file: File) =>
    apiFetch(`${BASE}/home-stories/${storyId}/photo`, {
      method: "POST",
      body: fdSingle(file, "file"),
    }),
  deleteHomeStory: (storyId: number) => apiFetch(`${BASE}/home-stories/${storyId}`, { method: "DELETE" }),

  listEvents: () => apiFetch(`${BASE}/events`),
  listArticles: () => apiFetch(`${BASE}/articles`),
};

const HELP_REQUESTS_PAGE_SIZE = 100;

export async function fetchOrgHelpRequestsAllPages(params?: {
  q?: string;
  tab?: string;
}): Promise<unknown[]> {
  const limit = HELP_REQUESTS_PAGE_SIZE;
  let offset = 0;
  const all: unknown[] = [];

  while (true) {
    const page = await meOrganizationApi.listHelpRequests({ ...params, limit, offset });
    const items = Array.isArray(page)
      ? page
      : page && typeof page === "object" && Array.isArray((page as { items?: unknown }).items)
        ? ((page as { items: unknown[] }).items ?? [])
        : [];
    all.push(...items);

    const total =
      page && typeof page === "object" && typeof (page as { total?: unknown }).total === "number"
        ? (page as { total: number }).total
        : items.length;

    if (items.length < limit || all.length >= total) break;
    offset += limit;
    if (offset > 10_000) break;
  }

  return all;
}

const ANIMALS_PAGE_SIZE = 100;

export async function fetchOrgAnimalsAllPages(params?: {
  q?: string;
}): Promise<unknown[]> {
  const limit = ANIMALS_PAGE_SIZE;
  let offset = 0;
  const all: unknown[] = [];

  while (true) {
    const page = await meOrganizationApi.listAnimals({ ...params, limit, offset });
    const items = Array.isArray(page)
      ? page
      : page && typeof page === "object" && Array.isArray((page as { items?: unknown }).items)
        ? ((page as { items: unknown[] }).items ?? [])
        : [];
    all.push(...items);

    const total =
      page && typeof page === "object" && typeof (page as { total?: unknown }).total === "number"
        ? (page as { total: number }).total
        : items.length;

    if (items.length < limit || all.length >= total) break;
    offset += limit;
    if (offset > 10_000) break;
  }

  return all;
}
