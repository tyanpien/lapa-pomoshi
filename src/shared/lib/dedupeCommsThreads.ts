import type { ChatThread } from "@/shared/lib/messages";

function pickNewerThread(a: ChatThread, b: ChatThread): ChatThread {
  if (a.id !== b.id) return a.id > b.id ? a : b;
  return a;
}

function sumUnread(a?: number, b?: number): number | undefined {
  const total = (a ?? 0) + (b ?? 0);
  return total > 0 ? total : undefined;
}

export function dedupeCommsThreadsByOrganization(threads: ChatThread[]): ChatThread[] {
  const byOrg = new Map<number, ChatThread>();
  const withoutOrg: ChatThread[] = [];

  for (const thread of threads) {
    const orgId = thread.organizationId;
    if (orgId == null || orgId < 1) {
      withoutOrg.push(thread);
      continue;
    }
    const prev = byOrg.get(orgId);
    if (!prev) {
      byOrg.set(orgId, thread);
      continue;
    }
    const newer = pickNewerThread(prev, thread);
    const older = newer.id === prev.id ? thread : prev;
    byOrg.set(orgId, {
      ...newer,
      unread: sumUnread(prev.unread, thread.unread),
      preview: newer.preview || older.preview,
      time: newer.time || older.time,
    });
  }

  return [...byOrg.values(), ...withoutOrg];
}

export function dedupeCommsThreadsByParticipant(threads: ChatThread[]): ChatThread[] {
  const byPeer = new Map<number, ChatThread>();
  const withoutPeer: ChatThread[] = [];

  for (const thread of threads) {
    const peerId = thread.participantUserId;
    if (peerId == null || peerId < 1) {
      withoutPeer.push(thread);
      continue;
    }
    const prev = byPeer.get(peerId);
    if (!prev) {
      byPeer.set(peerId, thread);
      continue;
    }
    const newer = pickNewerThread(prev, thread);
    const older = newer.id === prev.id ? thread : prev;
    byPeer.set(peerId, {
      ...newer,
      unread: sumUnread(prev.unread, thread.unread),
      preview: newer.preview || older.preview,
      time: newer.time || older.time,
    });
  }

  return [...byPeer.values(), ...withoutPeer];
}

export function dedupeCommsThreadsForRole(
  threads: ChatThread[],
  role: string | undefined
): ChatThread[] {
  if (role === "organization") return dedupeCommsThreadsByParticipant(threads);
  if (role === "volunteer" || role === "user") return dedupeCommsThreadsByOrganization(threads);
  return threads;
}
