import { apiFetch } from "../client";

const BASE = "/api/v1/me/volunteer";

export const meVolunteerCommunicationsApi = {
  listDialogs: () => apiFetch(`${BASE}/communications/dialogs`),
  getDialog: (dialogId: number) => apiFetch(`${BASE}/communications/dialogs/${dialogId}`),
  postDialogMessage: (dialogId: number, text: string) => {
    const fd = new FormData();
    fd.append("body", text);
    return apiFetch(`${BASE}/communications/dialogs/${dialogId}/messages`, {
      method: "POST",
      body: fd,
    });
  },
};
