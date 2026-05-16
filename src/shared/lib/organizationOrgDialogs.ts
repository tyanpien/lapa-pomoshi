import type { ChatMessage, ChatThread } from "@/shared/lib/messages";

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

function pickUserId(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && /^\d+$/.test(v.trim())) {
    const n = Number.parseInt(v.trim(), 10);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

export function mapOrgDialogListRow(row: Record<string, unknown>): ChatThread {
  const idRaw = row.id;
  const id =
    typeof idRaw === "number" && Number.isFinite(idRaw)
      ? idRaw
      : Number.parseInt(pickStr(idRaw), 10) || 0;
  const participantUserId =
    pickUserId(row.participant_user_id) ??
    pickUserId(row.peer_user_id) ??
    pickUserId(row.counterparty_user_id);
  return {
    id,
    title:
      pickStr(row.participant_name) ||
      pickStr(row.title) ||
      pickStr(row.peer_name) ||
      pickStr(row.counterparty_name) ||
      pickStr(row.subject) ||
      "Диалог",
    preview:
      pickStr(row.last_message_preview) ||
      pickStr(row.preview) ||
      pickStr(row.last_message_text) ||
      "",
    time: formatShortTime(row.updated_at ?? row.last_message_at ?? row.created_at),
    unread: typeof row.unread_count === "number" ? row.unread_count : undefined,
    participantUserId,
    messages: [],
  };
}

export function mapOrgDialogMessages(raw: unknown): ChatMessage[] {
  if (!raw || typeof raw !== "object") return [];
  const o = raw as Record<string, unknown>;
  const rawList = Array.isArray(o.messages)
    ? o.messages
    : Array.isArray(o.items)
      ? o.items
      : [];
  const msgs = rawList as Record<string, unknown>[];
  return msgs.map((r, i) => {
    const side = pickStr(r.sender_side ?? r.role ?? r.from).toLowerCase();
    const isMine =
      r.is_outgoing === true ||
      r.is_mine === true ||
      side === "me" ||
      side === "organization" ||
      side === "org" ||
      side === "sender";
    return {
      id: typeof r.id === "number" && Number.isFinite(r.id) ? r.id : i + 1,
      text: pickStr(r.text ?? r.body ?? r.content ?? r.message),
      time: formatShortTime(r.created_at ?? r.sent_at),
      from: isMine ? "me" : "other",
    };
  });
}
