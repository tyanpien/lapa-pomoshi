"use client";

import { FormEvent, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { meOrganizationApi } from "@/shared/api/endpoints/meOrganization";
import { meVolunteerCommunicationsApi } from "@/shared/api/endpoints/meVolunteerCommunications";
import { useUser } from "@/shared/lib/hooks/useUser";
import type { ChatMessage, ChatThread } from "@/shared/lib/messages";
import { mapOrgDialogListRow, mapOrgDialogMessages } from "@/shared/lib/organizationOrgDialogs";
import { unwrapApiList } from "@/shared/lib/organizationMeCabinet";
import { mapVolDialogListRow } from "@/shared/lib/volunteerOrgDialogs";
import styles from "./page.module.css";

function normalizePersonName(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function MessagesPageContent() {
  const { role } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [orgThreads, setOrgThreads] = useState<ChatThread[]>([]);
  const [orgDialogsLoading, setOrgDialogsLoading] = useState(false);
  const [orgDialogsReady, setOrgDialogsReady] = useState(false);
  const [volThreads, setVolThreads] = useState<ChatThread[]>([]);
  const [volDialogsLoading, setVolDialogsLoading] = useState(false);
  const [volDialogsReady, setVolDialogsReady] = useState(false);
  const [dialogMessages, setDialogMessages] = useState<ChatMessage[]>([]);
  const [volunteerDialogMessages, setVolunteerDialogMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sendError, setSendError] = useState("");
  const [recipientResolveError, setRecipientResolveError] = useState("");
  const ensureInflightRef = useRef(false);
  const ensureFailedPeerRef = useRef<number | null>(null);

  const pendingRecipientId = searchParams.get("recipientId");

  useEffect(() => {
    if (role !== "organization") {
      queueMicrotask(() => {
        setOrgThreads([]);
        setDialogMessages([]);
        setOrgDialogsReady(false);
      });
      return;
    }
    let cancelled = false;
    setOrgDialogsReady(false);
    queueMicrotask(() => {
      if (cancelled) return;
      setOrgDialogsLoading(true);
    });
    void meOrganizationApi
      .listDialogs()
      .then((raw) => {
        if (cancelled) return;
        const rows = unwrapApiList<Record<string, unknown>>(raw);
        setOrgThreads(rows.map((r) => mapOrgDialogListRow(r)));
      })
      .catch(() => {
        if (!cancelled) setOrgThreads([]);
      })
      .finally(() => {
        if (!cancelled) {
          setOrgDialogsLoading(false);
          setOrgDialogsReady(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [role]);

  useEffect(() => {
    if (role !== "volunteer") {
      queueMicrotask(() => {
        setVolThreads([]);
        setVolunteerDialogMessages([]);
        setVolDialogsReady(false);
      });
      return;
    }
    let cancelled = false;
    setVolDialogsReady(false);
    queueMicrotask(() => {
      if (!cancelled) setVolDialogsLoading(true);
    });
    void meVolunteerCommunicationsApi
      .listDialogs()
      .then((raw) => {
        if (cancelled) return;
        const rows = unwrapApiList<Record<string, unknown>>(raw);
        setVolThreads(rows.map((r) => mapVolDialogListRow(r)));
      })
      .catch(() => {
        if (!cancelled) setVolThreads([]);
      })
      .finally(() => {
        if (!cancelled) {
          setVolDialogsLoading(false);
          setVolDialogsReady(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [role]);

  const threads = useMemo(() => {
    if (role === "organization") return orgThreads;
    if (role === "volunteer") return volThreads;
    return [];
  }, [role, orgThreads, volThreads]);

  useEffect(() => {
    if (role !== "organization" || orgDialogsLoading || !orgDialogsReady) return;
    if (!pendingRecipientId?.trim()) {
      setRecipientResolveError("");
      ensureFailedPeerRef.current = null;
      return;
    }
    const peerId = Number.parseInt(pendingRecipientId.trim(), 10);
    if (!Number.isFinite(peerId)) {
      setRecipientResolveError("Некорректная ссылка на волонтёра.");
      return;
    }
    if (ensureFailedPeerRef.current === peerId) return;

    const nameGuess = (searchParams.get("recipientName") ?? "").trim();
    const match =
      threads.find((t) => t.participantUserId === peerId) ??
      (nameGuess.length >= 2
        ? threads.find((t) => normalizePersonName(t.title) === normalizePersonName(nameGuess))
        : undefined);

    if (match) {
      setRecipientResolveError("");
      ensureFailedPeerRef.current = null;
      const sp = new URLSearchParams(searchParams.toString());
      sp.delete("recipientId");
      sp.delete("recipientName");
      sp.set("thread", String(match.id));
      const qs = sp.toString();
      router.replace(qs ? `/messages?${qs}` : "/messages", { scroll: false });
      return;
    }

    if (ensureInflightRef.current) return;

    ensureInflightRef.current = true;
    setRecipientResolveError("");
    void meOrganizationApi
      .openVolunteerDialog(peerId)
      .then(() => meOrganizationApi.listDialogs())
      .then((raw) => {
        const rows = unwrapApiList<Record<string, unknown>>(raw);
        const mapped = rows.map((r) => mapOrgDialogListRow(r));
        setOrgThreads(mapped);
        const found =
          mapped.find((t) => t.participantUserId === peerId) ??
          (nameGuess.length >= 2
            ? mapped.find((t) => normalizePersonName(t.title) === normalizePersonName(nameGuess))
            : undefined);
        if (found) {
          ensureFailedPeerRef.current = null;
          const sp = new URLSearchParams(searchParams.toString());
          sp.delete("recipientId");
          sp.delete("recipientName");
          sp.set("thread", String(found.id));
          const qs = sp.toString();
          router.replace(qs ? `/messages?${qs}` : "/messages", { scroll: false });
        } else {
          ensureFailedPeerRef.current = peerId;
          setRecipientResolveError("Не удалось сопоставить открытый диалог. Обновите страницу.");
        }
      })
      .catch(() => {
        ensureFailedPeerRef.current = peerId;
        setRecipientResolveError("Не удалось открыть чат. Убедитесь, что пользователь — волонтёр.");
      })
      .finally(() => {
        ensureInflightRef.current = false;
      });
  }, [role, orgDialogsLoading, orgDialogsReady, threads, pendingRecipientId, searchParams, router]);

  const activeThreadId = useMemo(() => {
    if (!threads.length) return 0;
    const raw = searchParams.get("thread");
    if (raw != null && raw !== "") {
      const parsed = Number(raw);
      if (Number.isFinite(parsed) && threads.some((thread) => thread.id === parsed)) {
        return parsed;
      }
    }
    return threads[0]?.id ?? 0;
  }, [searchParams, threads]);

  const selectThread = useCallback(
    (id: number) => {
      router.replace(`/messages?thread=${id}`, { scroll: false });
    },
    [router]
  );

  useEffect(() => {
    const raw = searchParams.get("thread");
    if (raw == null || raw === "") {
      return;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || !threads.some((thread) => thread.id === parsed)) {
      return;
    }
    requestAnimationFrame(() => {
      document.getElementById(`thread-${parsed}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }, [searchParams, threads]);

  useEffect(() => {
    if (role !== "organization" || !activeThreadId) {
      queueMicrotask(() => setDialogMessages([]));
      return;
    }
    let cancelled = false;
    void meOrganizationApi.getDialog(activeThreadId).then((raw) => {
      if (cancelled) return;
      setDialogMessages(mapOrgDialogMessages(raw));
    });
    return () => {
      cancelled = true;
    };
  }, [role, activeThreadId]);

  useEffect(() => {
    if (role !== "volunteer" || !activeThreadId) {
      queueMicrotask(() => setVolunteerDialogMessages([]));
      return;
    }
    let cancelled = false;
    void meVolunteerCommunicationsApi.getDialog(activeThreadId).then((raw) => {
      if (cancelled) return;
      setVolunteerDialogMessages(mapOrgDialogMessages(raw));
    });
    return () => {
      cancelled = true;
    };
  }, [role, activeThreadId]);

  const activeThread =
    threads.find((thread) => thread.id === activeThreadId) ??
    threads[0] ?? {
      id: 0,
      title: "",
      preview: "",
      time: "",
      messages: [],
    };

  const displayedMessages =
    role === "organization"
      ? dialogMessages
      : role === "volunteer"
        ? volunteerDialogMessages
        : activeThread.messages;

  const handleSend = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSendError("");
    const text = draft.trim();
    if (!text) return;

    if (role === "organization") {
      if (!activeThreadId) return;
      void meOrganizationApi
        .postDialogMessage(activeThreadId, text)
        .then(() => meOrganizationApi.getDialog(activeThreadId))
        .then((raw) => {
          setDialogMessages(mapOrgDialogMessages(raw));
          setDraft("");
        })
        .catch(() => setSendError("Не удалось отправить сообщение."));
      return;
    }

    if (role === "volunteer") {
      if (!activeThreadId) return;
      void meVolunteerCommunicationsApi
        .postDialogMessage(activeThreadId, text)
        .then(() => meVolunteerCommunicationsApi.getDialog(activeThreadId))
        .then((raw) => {
          setVolunteerDialogMessages(mapOrgDialogMessages(raw));
          setDraft("");
        })
        .catch(() => setSendError("Не удалось отправить сообщение."));
      return;
    }

    setDraft("");
  };

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        {recipientResolveError ? (
          <p className={styles.recipientResolveBanner} role="alert">
            {recipientResolveError}
          </p>
        ) : null}
        <section className={styles.chatLayout}>
          <aside className={styles.chatList}>
            {role === "guest" ? (
              <div className={styles.chatListItem}>Загрузка…</div>
            ) : null}
            {role === "organization" && orgDialogsLoading ? (
              <div className={styles.chatListItem}>Загрузка диалогов…</div>
            ) : null}
            {role === "volunteer" && volDialogsLoading ? (
              <div className={styles.chatListItem}>Загрузка диалогов…</div>
            ) : null}
            {role === "organization" && !orgDialogsLoading && threads.length === 0 ? (
              <div className={styles.chatListItem}>Диалогов пока нет.</div>
            ) : null}
            {role === "volunteer" && !volDialogsLoading && threads.length === 0 ? (
              <div className={styles.chatListItem}>Диалогов пока нет.</div>
            ) : null}
            {threads.map((thread) => (
              <button
                key={thread.id}
                id={`thread-${thread.id}`}
                type="button"
                className={`${styles.chatListItem} ${activeThread.id === thread.id ? styles.active : ""}`}
                onClick={() => selectThread(thread.id)}
              >
                <span className={styles.avatar} />
                <span className={styles.chatListText}>
                  <span className={styles.chatListTitle}>{thread.title}</span>
                  <span className={styles.chatListPreview}>{thread.preview}</span>
                </span>
                <span className={styles.chatListMeta}>
                  <span className={styles.chatListTime}>{thread.time}</span>
                  {thread.unread ? <span className={styles.unread}>{thread.unread}</span> : null}
                </span>
              </button>
            ))}
          </aside>

          <section className={styles.chatPanel}>
            <h1 className={styles.chatTitle}>{activeThread.title}</h1>

            <div className={styles.chatWindow}>
              <div className={styles.dateBadge}>20 апреля</div>

              {displayedMessages.map((message) => (
                <article
                  key={message.id}
                  className={`${styles.messageRow} ${
                    message.from === "me" ? styles.messageRowMine : styles.messageRowOther
                  }`}
                >
                  {message.from === "other" ? <span className={styles.messageAvatar} /> : null}
                  <div className={styles.messageContent}>
                    <div
                      className={`${styles.messageBubble} ${
                        message.from === "me" ? styles.messageBubbleMine : styles.messageBubbleOther
                      }`}
                    >
                      {message.text}
                    </div>
                    <span className={styles.messageTime}>{message.time}</span>
                  </div>
                </article>
              ))}

              {sendError ? <p style={{ color: "#a33", fontSize: 13 }}>{sendError}</p> : null}

              <form className={styles.messageForm} onSubmit={handleSend}>
                <input
                  type="text"
                  placeholder={role === "volunteer" ? "Ответ волонтера..." : "Сообщение..."}
                  className={styles.messageInput}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                />
                <div className={styles.messageActions}>
                  <button type="button" className={styles.attachButton} aria-label="Прикрепить файл">
                    <img src="/screpka.svg" alt="прикрепить файл" />
                  </button>
                  <button type="submit" className={styles.sendButton}>
                    Отправить
                  </button>
                </div>
              </form>
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}

export default function MessagesPage() {
  return (
    <Suspense fallback={<div className={styles.page} style={{ minHeight: "50vh" }} />}>
      <MessagesPageContent />
    </Suspense>
  );
}
