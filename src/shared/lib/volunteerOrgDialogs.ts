import type { ChatThread } from "@/shared/lib/messages";

function pickStr(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function formatShortTime(iso: unknown): string {
  const s = pickStr(iso);
  if (!s) return "";
  try {
    const d = new Date(s);
    return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export function mapVolDialogListRow(row: Record<string, unknown>): ChatThread {
  const idRaw = row.id;
  const id =
    typeof idRaw === "number" && Number.isFinite(idRaw)
      ? idRaw
      : Number.parseInt(pickStr(idRaw), 10) || 0;
  return {
    id,
    title: pickStr(row.organization_name) || "Организация",
    preview:
      pickStr(row.last_message_preview) ||
      pickStr(row.preview) ||
      pickStr(row.last_message_text) ||
      "",
    time: formatShortTime(row.updated_at ?? row.last_message_at ?? row.created_at),
    unread: typeof row.unread_count === "number" ? row.unread_count : undefined,
    messages: [],
  };
}
