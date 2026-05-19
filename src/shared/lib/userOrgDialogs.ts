import { getImageUrl } from "@/shared/api/client";
import type { ChatMessage, ChatThread } from "@/shared/lib/messages";
import { mapOrgDialogDetailMeta, mapOrgDialogMessages } from "@/shared/lib/organizationOrgDialogs";

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

export function mapUserDialogListRow(row: Record<string, unknown>): ChatThread {
  const idRaw = row.id;
  const id =
    typeof idRaw === "number" && Number.isFinite(idRaw)
      ? idRaw
      : Number.parseInt(pickStr(idRaw), 10) || 0;
  const logoRaw = pickStr(row.organization_logo_url);
  return {
    id,
    title: pickStr(row.organization_name) || "Организация",
    avatarUrl: logoRaw ? getImageUrl(logoRaw) : undefined,
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

export function mapUserDialogMessages(raw: unknown): ChatMessage[] {
  return mapOrgDialogMessages(raw, "user");
}

export { mapOrgDialogDetailMeta as mapUserDialogDetailMeta };
