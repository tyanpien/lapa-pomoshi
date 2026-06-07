import { getImageUrl } from "@/shared/api/client";
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

export function normalizePersonName(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

export function volunteerNamesMatch(storedTitle: string, guess: string): boolean {
  const a = normalizePersonName(storedTitle);
  const b = normalizePersonName(guess);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  const aParts = a.split(" ").filter(Boolean);
  const bParts = b.split(" ").filter(Boolean);
  if (aParts.length >= 2 && bParts.length >= 2) {
    return aParts[0] === bParts[0] && aParts[aParts.length - 1] === bParts[bParts.length - 1];
  }
  return false;
}

export function pickOrgDialogId(raw: unknown): number | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const nested = o.dialog;
  const candidates = [o, nested && typeof nested === "object" ? (nested as Record<string, unknown>) : null];
  for (const c of candidates) {
    if (!c) continue;
    const id = pickUserId(c.id);
    if (id != null && id > 0) return id;
  }
  return undefined;
}

export function mapOpenedOrgDialog(raw: unknown): ChatThread | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.dialog && typeof o.dialog === "object") {
    return mapOrgDialogListRow(o.dialog as Record<string, unknown>);
  }
  if (o.id != null) {
    return mapOrgDialogListRow(o);
  }
  return null;
}

export function findOrgThreadForPeer(
  threads: ChatThread[],
  peerId: number,
  nameGuess?: string
): ChatThread | undefined {
  const byId = threads.find(
    (t) => t.participantUserId != null && Number(t.participantUserId) === peerId
  );
  if (byId) return byId;
  const name = (nameGuess ?? "").trim();
  if (name.length < 2) return undefined;
  return threads.find((t) => volunteerNamesMatch(t.title, name));
}

export function mergeOrgThreadList(prev: ChatThread[], thread: ChatThread): ChatThread[] {
  const idx = prev.findIndex((t) => t.id === thread.id);
  if (idx >= 0) {
    const next = [...prev];
    next[idx] = { ...next[idx], ...thread };
    return next;
  }
  return [thread, ...prev];
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
  const avatarRaw =
    pickStr(row.participant_avatar_url) ||
    pickStr(row.avatar_url) ||
    pickStr(row.peer_avatar_url);
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
    avatarUrl: avatarRaw ? getImageUrl(avatarRaw) : undefined,
    messages: [],
  };
}

export function mapOrgDialogDetailMeta(raw: unknown): { contextHint: string } {
  if (!raw || typeof raw !== "object") return { contextHint: "" };
  const o = raw as Record<string, unknown>;
  return { contextHint: pickStr(o.context_hint) };
}

export type DialogMessagePerspective = "organization" | "volunteer" | "user";

function resolveDialogMessageIsMine(
  r: Record<string, unknown>,
  perspective: DialogMessagePerspective
): boolean {
  if (r.is_outgoing === true || r.is_mine === true) return true;
  if (r.is_outgoing === false || r.is_mine === false) return false;

  const side = pickStr(r.sender_side ?? r.sender_role ?? r.role ?? r.from).toLowerCase();
  if (perspective === "organization") {
    return side === "me" || side === "organization" || side === "org";
  }
  if (perspective === "user") {
    return side === "me" || side === "user";
  }
  return side === "me" || side === "volunteer" || side === "vol";
}

export function mapCommsMessageItem(
  r: Record<string, unknown>,
  perspective: DialogMessagePerspective = "organization",
  fallbackId = 0
): ChatMessage {
  const isMine = resolveDialogMessageIsMine(r, perspective);
  const body = pickStr(r.text ?? r.body ?? r.content ?? r.message);
  const photoRaw = pickStr(r.photo_url);
  const photoUrl = photoRaw ? getImageUrl(photoRaw) : "";
  const text = body || (photoUrl ? "Фото" : "");
  return {
    id: typeof r.id === "number" && Number.isFinite(r.id) ? r.id : fallbackId,
    text,
    photoUrl: photoUrl || undefined,
    time: formatShortTime(r.created_at ?? r.sent_at),
    from: isMine ? "me" : "other",
  };
}

export function appendChatMessage(messages: ChatMessage[], msg: ChatMessage): ChatMessage[] {
  if (messages.some((m) => m.id === msg.id)) return messages;
  return [...messages, msg];
}

export type CommsMessageNewEvent = {
  type: "message.new";
  dialog_id: number;
  message: Record<string, unknown>;
  dialog: {
    id: number;
    last_message_preview?: string | null;
    last_message_at?: string | null;
    unread_count?: number;
  };
};

export function patchThreadsFromMessageNew(
  threads: ChatThread[],
  event: CommsMessageNewEvent,
  activeThreadId: number
): ChatThread[] | "missing" {
  const dialogId = event.dialog_id;
  const d = event.dialog;
  const preview =
    typeof d.last_message_preview === "string" ? d.last_message_preview : threads.find((t) => t.id === dialogId)?.preview ?? "";
  const time = formatShortTime(d.last_message_at);
  const isActive = dialogId === activeThreadId;
  const unreadRaw = typeof d.unread_count === "number" ? d.unread_count : undefined;
  const unread = isActive ? undefined : unreadRaw && unreadRaw > 0 ? unreadRaw : undefined;

  const idx = threads.findIndex((t) => t.id === dialogId);
  if (idx < 0) return "missing";

  const updated: ChatThread = {
    ...threads[idx],
    preview,
    time,
    unread,
  };
  const next = [...threads];
  next.splice(idx, 1);
  return [updated, ...next];
}

export function mapOrgDialogMessages(
  raw: unknown,
  perspective: DialogMessagePerspective = "organization"
): ChatMessage[] {
  if (!raw || typeof raw !== "object") return [];
  const o = raw as Record<string, unknown>;
  const rawList = Array.isArray(o.messages)
    ? o.messages
    : Array.isArray(o.items)
      ? o.items
      : [];
  const msgs = rawList as Record<string, unknown>[];
  return msgs.map((r, i) => mapCommsMessageItem(r, perspective, i + 1));
}
