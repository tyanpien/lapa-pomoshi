"use client";

import {
  FormEvent,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { meOrganizationApi } from "@/shared/api/endpoints/meOrganization";
import { meUserCommunicationsApi } from "@/shared/api/endpoints/meUserCommunications";
import { meVolunteerCommunicationsApi } from "@/shared/api/endpoints/meVolunteerCommunications";
import { useUser } from "@/shared/lib/hooks/useUser";
import type { ChatMessage, ChatThread } from "@/shared/lib/messages";
import {
  findOrgThreadForPeer,
  mapOpenedOrgDialog,
  mapOrgDialogDetailMeta,
  mapOrgDialogListRow,
  mapOrgDialogMessages,
  mergeOrgThreadList,
  pickOrgDialogId,
} from "@/shared/lib/organizationOrgDialogs";
import { fetchCommsDialogsAllPages } from "@/shared/lib/fetchCommsDialogsAllPages";
import { mapUserDialogListRow, mapUserDialogMessages, mapUserDialogDetailMeta } from "@/shared/lib/userOrgDialogs";
import { dedupeCommsThreadsForRole } from "@/shared/lib/dedupeCommsThreads";
import { mapVolDialogListRow, mapVolDialogMessages } from "@/shared/lib/volunteerOrgDialogs";
import styles from "./page.module.css";

const CHAT_IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/jpg";

function DialogAvatar({ url, className }: { url?: string; className: string }) {
  const src = url?.trim();
  if (src) {
    return <img src={src} alt="" className={className} />;
  }
  return <span className={className} aria-hidden />;
}

function formatListDialogsError(e: unknown) {
  const msg = e instanceof Error ? e.message : "";
  if (msg.includes("401") || msg.toLowerCase().includes("unauthorized")) {
    return "Сессия истекла — войдите снова.";
  }
  if (msg.includes("403")) {
    return "Нет доступа к списку диалогов для этой роли.";
  }
  return msg || "Не удалось загрузить диалоги с сервера. Проверьте, что бэкенд запущен.";
}

async function resolveOpenedOrgThreadId(
  openedRaw: unknown,
  setOrgThreads: Dispatch<SetStateAction<ChatThread[]>>,
  findThread?: (threads: ChatThread[]) => ChatThread | undefined
): Promise<number | null> {
  const openedThread = mapOpenedOrgDialog(openedRaw);
  const openedId = openedThread?.id ?? pickOrgDialogId(openedRaw);
  if (openedThread) {
    setOrgThreads((prev) => mergeOrgThreadList(prev, openedThread));
  }
  if (openedId != null && openedId > 0) {
    return openedId;
  }
  const rows = await fetchCommsDialogsAllPages((p) => meOrganizationApi.listDialogs(p));
  const mapped = rows.map((r) => mapOrgDialogListRow(r as Record<string, unknown>));
  setOrgThreads(mapped);
  const found = findThread?.(mapped) ?? mapped[0];
  return found?.id ?? null;
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
  const [userThreads, setUserThreads] = useState<ChatThread[]>([]);
  const [userDialogsLoading, setUserDialogsLoading] = useState(false);
  const [userDialogsReady, setUserDialogsReady] = useState(false);
  const [dialogMessages, setDialogMessages] = useState<ChatMessage[]>([]);
  const [volunteerDialogMessages, setVolunteerDialogMessages] = useState<ChatMessage[]>([]);
  const [userDialogMessages, setUserDialogMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [pendingImagePreview, setPendingImagePreview] = useState<string | null>(null);
  const [sendError, setSendError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dialogLoadError, setDialogLoadError] = useState("");
  const [dialogLoading, setDialogLoading] = useState(false);
  const [contextHint, setContextHint] = useState("");
  const [recipientResolveError, setRecipientResolveError] = useState("");
  const [listDialogsError, setListDialogsError] = useState("");
  const orgThreadsRef = useRef<ChatThread[]>([]);

  const pendingRecipientId = searchParams.get("recipientId");
  const pendingApplicationId = searchParams.get("applicationId");
  const pendingVolunteerResponseId = searchParams.get("volunteerResponseId");

  useEffect(() => {
    orgThreadsRef.current = orgThreads;
  }, [orgThreads]);

  useEffect(() => {
    return () => {
      if (pendingImagePreview) URL.revokeObjectURL(pendingImagePreview);
    };
  }, [pendingImagePreview]);

  const mapDialogList = useCallback(
    (rows: Record<string, unknown>[], mapper: (row: Record<string, unknown>) => ChatThread) =>
      dedupeCommsThreadsForRole(rows.map((r) => mapper(r)), role),
    [role]
  );

  const clearActiveThreadUnread = useCallback(
    (threadId: number) => {
      const patch = (prev: ChatThread[]) =>
        prev.map((t) => (t.id === threadId ? { ...t, unread: undefined } : t));
      if (role === "organization") setOrgThreads(patch);
      else if (role === "volunteer") setVolThreads(patch);
      else if (role === "user") setUserThreads(patch);
    },
    [role]
  );

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
    void fetchCommsDialogsAllPages((p) => meOrganizationApi.listDialogs(p))
      .then((rows) => {
        if (cancelled) return;
        setListDialogsError("");
        setOrgThreads(mapDialogList(rows as Record<string, unknown>[], mapOrgDialogListRow));
      })
      .catch((e) => {
        if (!cancelled) {
          setOrgThreads([]);
          setListDialogsError(formatListDialogsError(e));
        }
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
    void fetchCommsDialogsAllPages((p) => meVolunteerCommunicationsApi.listDialogs(p))
      .then((rows) => {
        if (cancelled) return;
        setListDialogsError("");
        setVolThreads(mapDialogList(rows as Record<string, unknown>[], mapVolDialogListRow));
      })
      .catch((e) => {
        if (!cancelled) {
          setVolThreads([]);
          setListDialogsError(formatListDialogsError(e));
        }
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

  useEffect(() => {
    if (role !== "user") {
      queueMicrotask(() => {
        setUserThreads([]);
        setUserDialogMessages([]);
        setUserDialogsReady(false);
      });
      return;
    }
    let cancelled = false;
    setUserDialogsReady(false);
    queueMicrotask(() => {
      if (!cancelled) setUserDialogsLoading(true);
    });
    void fetchCommsDialogsAllPages((p) => meUserCommunicationsApi.listDialogs(p))
      .then((rows) => {
        if (cancelled) return;
        setListDialogsError("");
        setUserThreads(mapDialogList(rows as Record<string, unknown>[], mapUserDialogListRow));
      })
      .catch((e) => {
        if (!cancelled) {
          setUserThreads([]);
          setListDialogsError(formatListDialogsError(e));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setUserDialogsLoading(false);
          setUserDialogsReady(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [role]);

  const threads = useMemo(() => {
    if (role === "organization") return orgThreads;
    if (role === "volunteer") return volThreads;
    if (role === "user") return userThreads;
    return [];
  }, [role, orgThreads, volThreads, userThreads]);

  const reloadOrgDialogs = useCallback(() => {
    return fetchCommsDialogsAllPages((p) => meOrganizationApi.listDialogs(p))
      .then((rows) => {
        setListDialogsError("");
        setOrgThreads(mapDialogList(rows as Record<string, unknown>[], mapOrgDialogListRow));
      })
      .catch((e) => {
        setOrgThreads([]);
        setListDialogsError(formatListDialogsError(e));
      });
  }, [mapDialogList]);

  useEffect(() => {
    if (role !== "organization" || orgDialogsLoading || !orgDialogsReady) return;
    if (!pendingRecipientId?.trim()) {
      setRecipientResolveError("");
      return;
    }
    const peerId = Number.parseInt(pendingRecipientId.trim(), 10);
    if (!Number.isFinite(peerId) || peerId < 1) {
      setRecipientResolveError("Некорректная ссылка на волонтёра.");
      return;
    }

    const nameGuess = (searchParams.get("recipientName") ?? "").trim();

    const navigateToThread = (threadId: number) => {
      setRecipientResolveError("");
      const sp = new URLSearchParams(searchParams.toString());
      sp.delete("recipientId");
      sp.delete("recipientName");
      sp.set("thread", String(threadId));
      const qs = sp.toString();
      router.replace(qs ? `/messages?${qs}` : "/messages", { scroll: false });
    };

    const existing = findOrgThreadForPeer(orgThreadsRef.current, peerId, nameGuess);
    if (existing) {
      navigateToThread(existing.id);
      return;
    }

    let cancelled = false;
    setRecipientResolveError("");

    void (async () => {
      try {
        const peerType = (searchParams.get("peerType") ?? "").trim().toLowerCase();
        const openedRaw =
          peerType === "user"
            ? await meOrganizationApi.openUserDialog(peerId, {
                participant_name: nameGuess || undefined,
              })
            : await meOrganizationApi.openVolunteerDialog(peerId, {
                participant_name: nameGuess || undefined,
              });
        if (cancelled) return;

        const openedId = await resolveOpenedOrgThreadId(openedRaw, setOrgThreads, (mapped) =>
          findOrgThreadForPeer(mapped, peerId, nameGuess)
        );
        if (cancelled) return;

        if (openedId != null && openedId > 0) {
          navigateToThread(openedId);
          void reloadOrgDialogs();
        } else {
          setRecipientResolveError(
            "Диалог создан, но не удалось открыть его автоматически. Выберите чат в списке слева."
          );
        }
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : "";
        if (msg.includes("404") || msg.toLowerCase().includes("не найден")) {
          setRecipientResolveError("Участник не найден. Откройте карточку ещё раз.");
        } else if (msg.includes("403") || msg.toLowerCase().includes("организац")) {
          setRecipientResolveError("Открыть чат могут только организации. Войдите под аккаунтом приюта.");
        } else if (msg.includes("400")) {
          setRecipientResolveError(msg);
        } else {
          setRecipientResolveError(msg || "Не удалось открыть чат.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [role, orgDialogsLoading, orgDialogsReady, pendingRecipientId, searchParams, router, reloadOrgDialogs]);

  useEffect(() => {
    if (role !== "organization" || orgDialogsLoading || !orgDialogsReady) return;
    if (!pendingVolunteerResponseId?.trim() || pendingRecipientId?.trim() || pendingApplicationId?.trim()) {
      return;
    }
    const responseId = Number.parseInt(pendingVolunteerResponseId.trim(), 10);
    if (!Number.isFinite(responseId) || responseId < 1) {
      setRecipientResolveError("Некорректная ссылка на отклик.");
      return;
    }

    const navigateToThread = (threadId: number) => {
      setRecipientResolveError("");
      const sp = new URLSearchParams(searchParams.toString());
      sp.delete("volunteerResponseId");
      sp.set("thread", String(threadId));
      const qs = sp.toString();
      router.replace(qs ? `/messages?${qs}` : "/messages", { scroll: false });
    };

    let cancelled = false;
    setRecipientResolveError("");

    void (async () => {
      try {
        const openedRaw = await meOrganizationApi.openIncomingVolunteerResponseDialog(responseId);
        if (cancelled) return;
        const openedId = await resolveOpenedOrgThreadId(openedRaw, setOrgThreads);
        if (cancelled) return;
        if (openedId != null && openedId > 0) {
          navigateToThread(openedId);
          void reloadOrgDialogs();
        } else {
          setRecipientResolveError(
            "Диалог создан, но не удалось открыть его автоматически. Выберите чат в списке слева."
          );
        }
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : "";
        if (msg.includes("404") || msg.toLowerCase().includes("не найден")) {
          setRecipientResolveError("Отклик не найден. Обновите список входящих заявок.");
        } else if (msg.includes("403") || msg.toLowerCase().includes("организац")) {
          setRecipientResolveError("Открыть чат могут только организации. Войдите под аккаунтом приюта.");
        } else {
          setRecipientResolveError(msg || "Не удалось открыть чат с волонтёром.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    role,
    orgDialogsLoading,
    orgDialogsReady,
    pendingVolunteerResponseId,
    pendingRecipientId,
    pendingApplicationId,
    searchParams,
    router,
    reloadOrgDialogs,
  ]);

  useEffect(() => {
    if (role !== "organization" || orgDialogsLoading || !orgDialogsReady) return;
    if (!pendingApplicationId?.trim() || pendingRecipientId?.trim() || pendingVolunteerResponseId?.trim()) {
      return;
    }
    const applicationId = Number.parseInt(pendingApplicationId.trim(), 10);
    if (!Number.isFinite(applicationId) || applicationId < 1) {
      setRecipientResolveError("Некорректная ссылка на анкету.");
      return;
    }

    const navigateToThread = (threadId: number) => {
      setRecipientResolveError("");
      const sp = new URLSearchParams(searchParams.toString());
      sp.delete("applicationId");
      sp.set("thread", String(threadId));
      const qs = sp.toString();
      router.replace(qs ? `/messages?${qs}` : "/messages", { scroll: false });
    };

    let cancelled = false;
    setRecipientResolveError("");

    void (async () => {
      try {
        const openedRaw = await meOrganizationApi.openIncomingAdoptionDialog(applicationId);
        if (cancelled) return;
        const openedId = await resolveOpenedOrgThreadId(openedRaw, setOrgThreads);
        if (cancelled) return;
        if (openedId != null && openedId > 0) {
          navigateToThread(openedId);
          void reloadOrgDialogs();
        } else {
          setRecipientResolveError(
            "Диалог создан, но не удалось открыть его автоматически. Выберите чат в списке слева."
          );
        }
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : "";
        if (msg.includes("404") || msg.toLowerCase().includes("не найден")) {
          setRecipientResolveError("Анкета не найдена. Обновите список входящих заявок.");
        } else if (msg.includes("403") || msg.toLowerCase().includes("организац")) {
          setRecipientResolveError("Открыть чат могут только организации. Войдите под аккаунтом приюта.");
        } else {
          setRecipientResolveError(msg || "Не удалось открыть чат с заявителем.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    role,
    orgDialogsLoading,
    orgDialogsReady,
    pendingApplicationId,
    pendingRecipientId,
    pendingVolunteerResponseId,
    searchParams,
    router,
    reloadOrgDialogs,
  ]);

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

  const reloadVolDialogs = useCallback(() => {
    return fetchCommsDialogsAllPages((p) => meVolunteerCommunicationsApi.listDialogs(p))
      .then((rows) => {
        setListDialogsError("");
        setVolThreads(mapDialogList(rows as Record<string, unknown>[], mapVolDialogListRow));
      })
      .catch((e) => {
        setVolThreads([]);
        setListDialogsError(formatListDialogsError(e));
      });
  }, [mapDialogList]);

  const reloadUserDialogs = useCallback(() => {
    return fetchCommsDialogsAllPages((p) => meUserCommunicationsApi.listDialogs(p))
      .then((rows) => {
        setListDialogsError("");
        setUserThreads(mapDialogList(rows as Record<string, unknown>[], mapUserDialogListRow));
      })
      .catch((e) => {
        setUserThreads([]);
        setListDialogsError(formatListDialogsError(e));
      });
  }, [mapDialogList]);

  useEffect(() => {
    if (role !== "organization" || !activeThreadId) {
      queueMicrotask(() => {
        setDialogMessages([]);
        setContextHint("");
        setDialogLoadError("");
      });
      return;
    }
    let cancelled = false;
    setDialogLoading(true);
    setDialogLoadError("");
    void meOrganizationApi
      .getDialog(activeThreadId)
      .then((raw) => {
        if (cancelled) return;
        setDialogMessages(mapOrgDialogMessages(raw));
        setContextHint(mapOrgDialogDetailMeta(raw).contextHint);
        clearActiveThreadUnread(activeThreadId);
        return reloadOrgDialogs();
      })
      .catch((e) => {
        if (cancelled) return;
        setDialogMessages([]);
        setContextHint("");
        const msg = e instanceof Error ? e.message : "";
        setDialogLoadError(
          msg.includes("500")
            ? "Сервер вернул ошибку при открытии чата. Список диалогов загружается, но история сообщений сейчас недоступна — нужна правка на бэкенде (см. ниже)."
            : "Не удалось загрузить переписку."
        );
      })
      .finally(() => {
        if (!cancelled) setDialogLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [role, activeThreadId, clearActiveThreadUnread, reloadOrgDialogs]);

  useEffect(() => {
    if (role !== "volunteer" || !activeThreadId) {
      queueMicrotask(() => {
        setVolunteerDialogMessages([]);
        setContextHint("");
        setDialogLoadError("");
      });
      return;
    }
    let cancelled = false;
    setDialogLoading(true);
    setDialogLoadError("");
    void meVolunteerCommunicationsApi
      .getDialog(activeThreadId)
      .then((raw) => {
        if (cancelled) return;
        setVolunteerDialogMessages(mapVolDialogMessages(raw));
        setContextHint(mapOrgDialogDetailMeta(raw).contextHint);
        clearActiveThreadUnread(activeThreadId);
        return reloadVolDialogs();
      })
      .catch((e) => {
        if (cancelled) return;
        setVolunteerDialogMessages([]);
        setContextHint("");
        const msg = e instanceof Error ? e.message : "";
        setDialogLoadError(
          msg.includes("500")
            ? "Не удалось загрузить переписку (ошибка сервера). Нужна правка бэкенда для PostgreSQL (см. сообщение для организации)."
            : "Не удалось загрузить переписку. Ответ возможен только после сообщения организации."
        );
      })
      .finally(() => {
        if (!cancelled) setDialogLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [role, activeThreadId, clearActiveThreadUnread, reloadVolDialogs]);

  useEffect(() => {
    if (role !== "user" || !activeThreadId) {
      queueMicrotask(() => {
        setUserDialogMessages([]);
        setContextHint("");
        setDialogLoadError("");
      });
      return;
    }
    let cancelled = false;
    setDialogLoading(true);
    setDialogLoadError("");
    void meUserCommunicationsApi
      .getDialog(activeThreadId)
      .then((raw) => {
        if (cancelled) return;
        setUserDialogMessages(mapUserDialogMessages(raw));
        setContextHint(mapUserDialogDetailMeta(raw).contextHint);
        clearActiveThreadUnread(activeThreadId);
        return reloadUserDialogs();
      })
      .catch((e) => {
        if (cancelled) return;
        setUserDialogMessages([]);
        setContextHint("");
        const msg = e instanceof Error ? e.message : "";
        setDialogLoadError(
          msg.includes("500")
            ? "Не удалось загрузить переписку (ошибка сервера)."
            : "Не удалось загрузить переписку. Ответ возможен только после сообщения организации."
        );
      })
      .finally(() => {
        if (!cancelled) setDialogLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [role, activeThreadId, clearActiveThreadUnread, reloadUserDialogs]);

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
        : role === "user"
          ? userDialogMessages
          : activeThread.messages;

  const clearPendingImage = useCallback(() => {
    setPendingImage(null);
    setPendingImagePreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, []);

  const handlePickImage = () => {
    setSendError("");
    fileInputRef.current?.click();
  };

  const handleImageSelected = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setSendError("Можно прикрепить только изображение (JPG, PNG, WebP).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setSendError("Размер файла — не больше 5 МБ.");
      return;
    }
    setSendError("");
    setPendingImagePreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setPendingImage(file);
  };

  const handleSend = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSendError("");
    const text = draft.trim();
    const image = pendingImage;
    if (!text && !image) return;

    const afterSendClear = () => {
      setDraft("");
      clearPendingImage();
    };

    if (role === "organization") {
      if (!activeThreadId) return;
      void meOrganizationApi
        .postDialogMessage(activeThreadId, text, image)
        .then(() => meOrganizationApi.getDialog(activeThreadId))
        .then((raw) => {
          setDialogMessages(mapOrgDialogMessages(raw));
          setContextHint(mapOrgDialogDetailMeta(raw).contextHint);
          setDialogLoadError("");
          afterSendClear();
          return reloadOrgDialogs();
        })
        .catch((e) => {
          const msg = e instanceof Error ? e.message : "";
          if (msg.includes("403")) {
            setSendError("Не удалось отправить: проверьте права или обновите страницу.");
          } else {
            setSendError("Не удалось отправить сообщение.");
          }
        });
      return;
    }

    if (role === "volunteer") {
      if (!activeThreadId) return;
      void meVolunteerCommunicationsApi
        .postDialogMessage(activeThreadId, text, image)
        .then(() => meVolunteerCommunicationsApi.getDialog(activeThreadId))
        .then((raw) => {
          setVolunteerDialogMessages(mapVolDialogMessages(raw));
          setContextHint(mapOrgDialogDetailMeta(raw).contextHint);
          setDialogLoadError("");
          afterSendClear();
          return reloadVolDialogs();
        })
        .catch((e) => {
          const msg = e instanceof Error ? e.message : "";
          if (msg.includes("403")) {
            setSendError(
              "Организация ещё не писала в этот чат — дождитесь первого сообщения от приюта."
            );
          } else {
            setSendError("Не удалось отправить сообщение.");
          }
        });
      return;
    }

    if (role === "user") {
      if (!activeThreadId) return;
      void meUserCommunicationsApi
        .postDialogMessage(activeThreadId, text, image)
        .then(() => meUserCommunicationsApi.getDialog(activeThreadId))
        .then((raw) => {
          setUserDialogMessages(mapUserDialogMessages(raw));
          setContextHint(mapUserDialogDetailMeta(raw).contextHint);
          setDialogLoadError("");
          afterSendClear();
          return reloadUserDialogs();
        })
        .catch((e) => {
          const msg = e instanceof Error ? e.message : "";
          if (msg.includes("403")) {
            setSendError(
              "Организация ещё не писала в этот чат — дождитесь первого сообщения от приюта."
            );
          } else {
            setSendError("Не удалось отправить сообщение.");
          }
        });
      return;
    }

    setDraft("");
  };

  const dialogsLoading =
    (role === "organization" && orgDialogsLoading) ||
    (role === "volunteer" && volDialogsLoading) ||
    (role === "user" && userDialogsLoading);

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        {listDialogsError ? (
          <p className={styles.recipientResolveBanner} role="alert">
            {listDialogsError}
          </p>
        ) : null}
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
            {dialogsLoading ? <div className={styles.chatListItem}>Загрузка диалогов…</div> : null}
            {!dialogsLoading && role !== "guest" && threads.length === 0 ? (
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
                <DialogAvatar url={thread.avatarUrl} className={styles.avatar} />
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
            {contextHint ? <p className={styles.contextHint}>{contextHint}</p> : null}

            <div className={styles.chatWindow}>
              {dialogLoading ? <p className={styles.dialogStatus}>Загрузка сообщений…</p> : null}
              {dialogLoadError ? (
                <p className={styles.dialogError} role="alert">
                  {dialogLoadError}
                </p>
              ) : null}

              {!dialogLoading &&
              !dialogLoadError &&
              displayedMessages.length === 0 &&
              activeThreadId > 0 ? (
                <p className={styles.dialogStatus}>Сообщений пока нет. Напишите первым.</p>
              ) : null}

              {displayedMessages.map((message) => (
                <article
                  key={message.id}
                  className={`${styles.messageRow} ${
                    message.from === "me" ? styles.messageRowMine : styles.messageRowOther
                  }`}
                >
                  {message.from === "other" ? (
                    <DialogAvatar url={activeThread.avatarUrl} className={styles.messageAvatar} />
                  ) : null}
                  <div className={styles.messageContent}>
                    <div
                      className={`${styles.messageBubble} ${
                        message.from === "me" ? styles.messageBubbleMine : styles.messageBubbleOther
                      }`}
                    >
                      {message.photoUrl ? (
                        <img src={message.photoUrl} alt="" className={styles.messagePhoto} />
                      ) : null}
                      {message.text ? <span>{message.text}</span> : null}
                    </div>
                    <span className={styles.messageTime}>{message.time}</span>
                  </div>
                </article>
              ))}

              {sendError ? <p className={styles.sendError}>{sendError}</p> : null}

              {pendingImagePreview ? (
                <div className={styles.pendingImageWrap}>
                  <img src={pendingImagePreview} alt="" className={styles.pendingImage} />
                  <button
                    type="button"
                    className={styles.pendingImageRemove}
                    onClick={clearPendingImage}
                  >
                    Убрать фото
                  </button>
                </div>
              ) : null}

              <form className={styles.messageForm} onSubmit={handleSend}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={CHAT_IMAGE_ACCEPT}
                  className={styles.hiddenFileInput}
                  tabIndex={-1}
                  aria-hidden="true"
                  onChange={handleImageSelected}
                />
                <input
                  type="text"
                  placeholder={role === "volunteer" ? "Ответ волонтера..." : "Сообщение..."}
                  className={styles.messageInput}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                />
                <div className={styles.messageActions}>
                  <button
                    type="button"
                    className={styles.attachButton}
                    aria-label="Прикрепить фото"
                    onClick={handlePickImage}
                  >
                    <img src="/screpka.svg" alt="" />
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
