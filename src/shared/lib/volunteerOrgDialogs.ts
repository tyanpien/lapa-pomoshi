import { getImageUrl } from "@/shared/api/client";
import type { ChatMessage, ChatThread } from "@/shared/lib/messages";
import { mapOrgDialogMessages } from "@/shared/lib/organizationOrgDialogs";

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
  const logoRaw = pickStr(row.organization_logo_url);
  const orgIdRaw = row.organization_id;
  const organizationId =
    typeof orgIdRaw === "number" && Number.isFinite(orgIdRaw)
      ? orgIdRaw
      : Number.parseInt(pickStr(orgIdRaw), 10) || undefined;
  return {
    id,
    organizationId: organizationId && organizationId > 0 ? organizationId : undefined,
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

export function mapVolDialogMessages(raw: unknown): ChatMessage[] {
  return mapOrgDialogMessages(raw, "volunteer");
}
