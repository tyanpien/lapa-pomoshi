export type VolunteerResponseUiStatus =
  | "На рассмотрении"
  | "В работе"
  | "Завершено"
  | "Отменено"
  | "Отклонено";

export function mapVolunteerResponseStatus(
  raw: string,
  labelFallback?: string | null,
): VolunteerResponseUiStatus {
  const s = `${raw ?? ""}`.trim().toLowerCase();
  if (s === "pending") return "На рассмотрении";
  if (s === "accepted") return "В работе";
  if (s === "completed") return "Завершено";
  if (s === "rejected") return "Отклонено";
  if (s === "withdrawn") return "Отменено";
  if (labelFallback?.trim()) {
    const lb = labelFallback.trim();
    if (lb.includes("На рассмотрении")) return "На рассмотрении";
    if (lb.includes("В работ")) return "В работе";
    if (lb.includes("Заверш")) return "Завершено";
    if (lb.includes("Отклон")) return "Отклонено";
    if (lb.includes("Отмен")) return "Отменено";
  }
  if (s.includes("withdraw")) return "Отменено";
  if (s.includes("reject")) return "Отклонено";
  if (s.includes("accept") || s.includes("progress")) return "В работе";
  if (s.includes("done") || s.includes("complete")) return "Завершено";
  return "На рассмотрении";
}

export type VolunteerHelpRequestResponseRef = {
  responseId: number;
  status: string;
  statusUi: VolunteerResponseUiStatus;
};

export function indexResponsesByHelpRequestId(
  items: { id: number; help_request_id: number; status: string; status_label?: string | null }[],
): Record<number, VolunteerHelpRequestResponseRef> {
  const out: Record<number, VolunteerHelpRequestResponseRef> = {};
  for (const item of items) {
    const helpRequestId = Number(item.help_request_id);
    const responseId = Number(item.id);
    if (!Number.isFinite(helpRequestId) || !Number.isFinite(responseId)) continue;
    out[helpRequestId] = {
      responseId,
      status: String(item.status ?? ""),
      statusUi: mapVolunteerResponseStatus(String(item.status ?? ""), item.status_label),
    };
  }
  return out;
}
