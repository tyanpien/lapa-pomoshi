import { apiFetch } from "../client";

const BASE = "/api/v1/me/user";

export const meUserCommunicationsApi = {
  listDialogs: (params?: { limit?: number; offset?: number }) => {
    const q = new URLSearchParams();
    const limit = Math.min(100, Math.max(1, params?.limit ?? 100));
    q.set("limit", String(limit));
    q.set("offset", String(params?.offset ?? 0));
    return apiFetch(`${BASE}/communications/dialogs?${q.toString()}`);
  },
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
};
