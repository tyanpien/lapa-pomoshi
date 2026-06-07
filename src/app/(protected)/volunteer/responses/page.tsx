"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import styles from "./page.module.css";
import {
  meVolunteerResponsesApi,
  VOLUNTEER_REPORT_PHOTOS_MAX,
  VOLUNTEER_REPORT_PHOTOS_MIN,
  type VolunteerResponseCardDto,
  type VolunteerReportOut,
  type VolunteerResponseDetailDto,
} from "@/shared/api/endpoints/meVolunteerResponses";
import { ResponseCardDescription } from "./responseCardDescription";
import { volunteerResponseStatusClassMap } from "@/shared/lib/volunteerResponseStatusClassMap";
import {
  compareVolunteerResponsesByStatus,
  mapVolunteerResponseStatus,
  type VolunteerResponseUiStatus,
} from "@/shared/lib/volunteerResponseStatus";

export type ResponseStatus = VolunteerResponseUiStatus;

export type ResponseFilter = ResponseStatus | "Архив" | "Все";

export type ResponseCard = {
  id: number;
  helpType: string;
  organization: string;
  organizationHref: string;
  title: string;
  descriptionSnippet: string;
  descriptionFull: string | null;
  dateLabel: string;
  createdAt: string | null;
  status: ResponseStatus;
  urgent?: boolean;
  canChat?: boolean;
  chatThreadId?: number;
  reportAwaiting?: boolean;
  canSendReport?: boolean;
  canViewReport?: boolean;
};

const filterOptions: { label: string; value: ResponseFilter }[] = [
  { label: "На рассмотрении", value: "На рассмотрении" },
  { label: "В работе", value: "В работе" },
  { label: "Завершенные", value: "Завершено" },
  { label: "Архив", value: "Архив" },
  { label: "Все", value: "Все" },
];

const statusClassMap: Record<ResponseStatus, string> = volunteerResponseStatusClassMap;

type ReportPhotoDraft = {
  key: string;
  previewUrl: string;
  file: File;
};

const ALLOWED_REPORT_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function newReportPhotoKey(): string {
  return `report-photo-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function ResponseScrollFromQuery({ onTargetId }: { onTargetId: (id: number | null) => void }) {
  const searchParams = useSearchParams();

  useEffect(() => {
    const raw = searchParams.get("response");
    if (raw == null || raw === "") {
      onTargetId(null);
      return;
    }
    const id = Number(raw);
    if (!Number.isFinite(id)) {
      onTargetId(null);
      return;
    }
    onTargetId(id);
  }, [searchParams, onTargetId]);

  return null;
}

export default function VolunteerResponsesPage() {
  const [activeFilter, setActiveFilter] = useState<ResponseFilter>("Все");
  const [scrollToResponseId, setScrollToResponseId] = useState<number | null>(null);
  const [apiResponses, setApiResponses] = useState<ResponseCard[]>([]);
  const [apiErrorText, setApiErrorText] = useState("");
  const [reportModalResponseId, setReportModalResponseId] = useState<number | null>(null);
  const [reportText, setReportText] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState("");
  const [existingReport, setExistingReport] = useState<VolunteerReportOut | null>(null);
  const [reportPhotos, setReportPhotos] = useState<ReportPhotoDraft[]>([]);
  const reportPhotoInputRef = useRef<HTMLInputElement>(null);
  const [editMessageId, setEditMessageId] = useState<number | null>(null);
  const [editMessageDraft, setEditMessageDraft] = useState("");
  const [patchLoading, setPatchLoading] = useState(false);
  const [expandedResponseIds, setExpandedResponseIds] = useState<Set<number>>(() => new Set());
  const [loadingResponseDetailId, setLoadingResponseDetailId] = useState<number | null>(null);

  const reloadList = useCallback(() => {
    setApiErrorText("");
    void meVolunteerResponsesApi
      .getList({ tab: "all", limit: 100, offset: 0 })
      .then((raw) => {
        const rows = raw.items ?? [];
        const mapped = rows.map(mapCardDtoToUi).filter(Boolean) as ResponseCard[];
        setApiResponses(mapped);
        setExpandedResponseIds(new Set());
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err ?? "");
        if (msg.includes("401")) {
          setApiErrorText("Нет доступа (401). Войдите заново как волонтёр.");
        } else {
          setApiErrorText("Не удалось загрузить отклики из API.");
        }
        setApiResponses([]);
      });
  }, []);

  const applyResponseFromQuery = useCallback((id: number | null) => {
    setScrollToResponseId(id);
    if (id != null) {
      setActiveFilter("Все");
      void meVolunteerResponsesApi
        .getById(id)
        .then((fresh) => {
          const next = mapDetailDtoToUi(fresh);
          if (!next) return;
          setApiResponses((prev) => {
            const rest = prev.filter((x) => x.id !== next.id);
            return [next, ...rest];
          });
        })
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    reloadList();
  }, [reloadList]);

  useEffect(() => {
    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") reloadList();
    };
    const intervalId = window.setInterval(refreshIfVisible, 20_000);
    window.addEventListener("visibilitychange", refreshIfVisible);
    window.addEventListener("focus", refreshIfVisible);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("visibilitychange", refreshIfVisible);
      window.removeEventListener("focus", refreshIfVisible);
    };
  }, [reloadList]);

  useEffect(() => {
    const id = reportModalResponseId;
    if (id == null) {
      setExistingReport(null);
      setReportText("");
      setReportPhotos([]);
      setReportError("");
      setReportLoading(false);
      return;
    }

    let cancelled = false;
    setReportLoading(true);
    setReportError("");
    void meVolunteerResponsesApi
      .getReport(id)
      .then((report) => {
        if (cancelled) return;
        setExistingReport(report ?? null);
        const text = report?.content && typeof report.content === "string" ? report.content : "";
        setReportText(text);
      })
      .catch(() => {
        if (cancelled) return;
        setExistingReport(null);
        setReportText("");
      })
      .finally(() => {
        if (!cancelled) setReportLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [reportModalResponseId]);

  useEffect(() => {
    const id = editMessageId;
    if (id == null) {
      setEditMessageDraft("");
      return;
    }
    const row = apiResponses.find((r) => r.id === id);
    setEditMessageDraft("");
    void meVolunteerResponsesApi
      .getById(id)
      .then((d) => {
        setEditMessageDraft(typeof d.message === "string" ? d.message : "");
      })
      .catch(() => setEditMessageDraft(""));
  }, [editMessageId, apiResponses]);

  const reportModalCard = useMemo(
    () => (reportModalResponseId != null ? apiResponses.find((r) => r.id === reportModalResponseId) ?? null : null),
    [apiResponses, reportModalResponseId],
  );
  const reportModalReadOnly = reportModalCard?.status === "Завершено";
  const canSubmitReport =
    reportText.trim().length >= 10 &&
    reportPhotos.length >= VOLUNTEER_REPORT_PHOTOS_MIN &&
    reportPhotos.length <= VOLUNTEER_REPORT_PHOTOS_MAX;

  const handleReportPhotoInput = (files: FileList | null) => {
    if (!files?.length || reportModalReadOnly) return;
    const remaining = VOLUNTEER_REPORT_PHOTOS_MAX - reportPhotos.length;
    if (remaining <= 0) {
      setReportError(`Можно прикрепить не более ${VOLUNTEER_REPORT_PHOTOS_MAX} фото.`);
      return;
    }

    const batch = Array.from(files).slice(0, remaining);
    void (async () => {
      const next: ReportPhotoDraft[] = [...reportPhotos];
      for (const file of batch) {
        if (next.length >= VOLUNTEER_REPORT_PHOTOS_MAX) break;
        if (!ALLOWED_REPORT_PHOTO_TYPES.has(file.type)) {
          setReportError("Допустимые форматы: JPG, PNG, WEBP.");
          continue;
        }
        if (file.size > 5 * 1024 * 1024) {
          setReportError("Каждое фото должно быть не больше 5 МБ.");
          continue;
        }
        const previewUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result ?? ""));
          reader.onerror = () => reject(new Error("read failed"));
          reader.readAsDataURL(file);
        });
        next.push({ key: newReportPhotoKey(), previewUrl, file });
      }
      setReportPhotos(next);
      setReportError("");
    })().finally(() => {
      if (reportPhotoInputRef.current) reportPhotoInputRef.current.value = "";
    });
  };

  const removeReportPhoto = (key: string) => {
    setReportPhotos((prev) => prev.filter((photo) => photo.key !== key));
  };

  const filteredResponses = useMemo(() => {
    let items = apiResponses;
    if (activeFilter === "Архив") {
      items = apiResponses.filter((item) => item.status === "Отменено" || item.status === "Отклонено");
    } else if (activeFilter !== "Все") {
      items = apiResponses.filter((item) => item.status === activeFilter);
    }
    return [...items].sort(compareVolunteerResponsesByStatus);
  }, [activeFilter, apiResponses]);

  useEffect(() => {
    if (scrollToResponseId == null) return;
    const id = scrollToResponseId;
    if (!filteredResponses.some((item) => item.id === id)) return;

    let cancelled = false;
    let removeHighlightTimer: number | undefined;
    const raf = requestAnimationFrame(() => {
      if (cancelled) return;
      const el = document.getElementById(`response-${id}`);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add(styles.cardFocused);
      removeHighlightTimer = window.setTimeout(() => {
        el.classList.remove(styles.cardFocused);
      }, 2200);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      if (removeHighlightTimer !== undefined) window.clearTimeout(removeHighlightTimer);
      document.getElementById(`response-${id}`)?.classList.remove(styles.cardFocused);
    };
  }, [scrollToResponseId, filteredResponses]);

  const handleExpandResponse = useCallback((item: ResponseCard) => {
    if (item.descriptionFull != null) {
      setExpandedResponseIds((prev) => new Set(prev).add(item.id));
      return;
    }
    setLoadingResponseDetailId(item.id);
    void meVolunteerResponsesApi
      .getById(item.id)
      .then((fresh) => {
        const next = mapDetailDtoToUi(fresh);
        if (next) {
          setApiResponses((prev) => prev.map((r) => (r.id === item.id ? next : r)));
        }
        setExpandedResponseIds((prev) => new Set(prev).add(item.id));
      })
      .catch(() => {})
      .finally(() => setLoadingResponseDetailId(null));
  }, []);

  const handleCollapseResponse = useCallback((id: number) => {
    setExpandedResponseIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const handleCancelResponse = (id: number) => {
    void meVolunteerResponsesApi
      .cancel(id)
      .then(() => meVolunteerResponsesApi.getById(id))
      .then((fresh) => {
        const next = mapDetailDtoToUi(fresh as VolunteerResponseDetailDto);
        if (!next) return;
        setApiResponses((prev) => {
          const rest = prev.filter((x) => x.id !== next.id);
          return [next, ...rest];
        });
      })
      .catch(() => {})
      .finally(() => reloadList());
  };

  return (
    <main className={styles.page}>
      <Suspense fallback={null}>
        <ResponseScrollFromQuery onTargetId={applyResponseFromQuery} />
      </Suspense>
      <div className={styles.container}>
        <header className={styles.top}>
          <h1>Мои отклики</h1>
          <div className={styles.filters}>
            {filterOptions.map((filter) => (
              <button
                key={filter.value}
                type="button"
                className={`${styles.filterBtn} ${activeFilter === filter.value ? styles.filterBtnActive : ""}`}
                onClick={() => setActiveFilter(filter.value)}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </header>

        {apiErrorText ? <p className={styles.description}>{apiErrorText}</p> : null}

        <section className={styles.grid}>
          {filteredResponses.map((item) => (
            <article
              key={item.id}
              id={`response-${item.id}`}
              className={`${styles.card} ${
                item.status === "Отменено" || item.status === "Отклонено" ? styles.cardCancelled : ""
              }`}
            >
              <div className={styles.cardTop}>
                <div className={styles.metaLeft}>
                  <Link href={item.organizationHref} className={styles.organization}>
                    {item.organization}
                  </Link>
                </div>
                {item.urgent ? <span className={styles.urgent}>срочно</span> : null}
              </div>

              <h2 className={styles.title}>{item.title}</h2>
              <ResponseCardDescription
                item={item}
                expanded={expandedResponseIds.has(item.id)}
                loadingDetail={loadingResponseDetailId === item.id}
                onExpand={() => handleExpandResponse(item)}
                onCollapse={() => handleCollapseResponse(item.id)}
              />

              <div className={styles.timeRow}>
                <img src="/clock.svg" alt="" aria-hidden="true" />
                <span>{item.dateLabel}</span>
              </div>

              <div className={styles.bottom}>
                <div className={styles.actions}>
                  {item.status !== "Отменено" && item.status !== "Отклонено" && item.canChat !== false ? (
                    item.chatThreadId != null ? (
                      <Link href={`/messages?thread=${item.chatThreadId}`} className={styles.chatBtn}>
                        Чат
                      </Link>
                    ) : (
                      <span className={styles.chatBtnMuted} title="Чат откроется после принятия отклика организацией">
                        Чат
                      </span>
                    )
                  ) : null}
                  {item.status === "На рассмотрении" ? (
                    <>
                      <button type="button" className={styles.secondaryBtn} onClick={() => handleCancelResponse(item.id)}>
                        Отменить отклик
                      </button>
                    </>
                  ) : null}
                  {item.status === "В работе" && item.canSendReport ? (
                    <button type="button" className={styles.secondaryBtn} onClick={() => setReportModalResponseId(item.id)}>
                      {item.reportAwaiting ? "Обновить отчёт" : "Отправить отчёт"}
                    </button>
                  ) : null}
                  {item.status === "Завершено" && item.canViewReport ? (
                    <button type="button" className={styles.secondaryBtn} onClick={() => setReportModalResponseId(item.id)}>
                      Посмотреть отчёт
                    </button>
                  ) : null}
                </div>
                <span className={`${styles.status} ${styles[statusClassMap[item.status]]}`}>
                  {item.status}
                  {item.reportAwaiting && item.status === "В работе" ? (
                    <span className={styles.statusSub}> · отчёт на проверке</span>
                  ) : null}
                </span>
              </div>
            </article>
          ))}
        </section>
      </div>

      {reportModalResponseId != null ? (
        <div className={styles.modalOverlay} onClick={() => setReportModalResponseId(null)}>
          <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
            <h2 className={styles.modalTitle}>
              {reportModalReadOnly ? "Отчёт по задаче" : "Отчёт по отклику"}
            </h2>
            {!reportModalReadOnly ? (
              <p className={styles.modalHint}>
                Опишите, что сделали (не менее 10 символов) и приложите от {VOLUNTEER_REPORT_PHOTOS_MIN} до{" "}
                {VOLUNTEER_REPORT_PHOTOS_MAX} фото. После отправки организация проверит отчёт и завершит задачу.
              </p>
            ) : null}

            <label className={styles.modalLabel}>
              Текст отчета
              <textarea
                className={styles.modalTextarea}
                value={reportText}
                onChange={(event) => setReportText(event.target.value)}
                placeholder="Что было сделано, результат, детали"
                disabled={reportLoading || reportModalReadOnly}
                readOnly={reportModalReadOnly}
              />
            </label>

            <div className={styles.modalLabel}>
              {reportModalReadOnly ? "Фото отчёта" : `Фото отчёта (${reportPhotos.length}/${VOLUNTEER_REPORT_PHOTOS_MAX})`}
              <div className={styles.reportPhotoGrid}>
                {reportModalReadOnly
                  ? (existingReport?.photo_urls ?? []).map((url) => (
                      <a
                        key={url}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.reportPhotoItem}
                      >
                        <img src={url} alt="Фото отчёта" className={styles.reportPhotoImage} />
                      </a>
                    ))
                  : reportPhotos.map((photo) => (
                      <div key={photo.key} className={styles.reportPhotoItem}>
                        <img src={photo.previewUrl} alt="Предпросмотр" className={styles.reportPhotoImage} />
                        <button
                          type="button"
                          className={styles.reportPhotoRemove}
                          onClick={() => removeReportPhoto(photo.key)}
                          disabled={reportLoading}
                          aria-label="Удалить фото"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                {!reportModalReadOnly && reportPhotos.length < VOLUNTEER_REPORT_PHOTOS_MAX ? (
                  <button
                    type="button"
                    className={styles.reportPhotoAdd}
                    onClick={() => reportPhotoInputRef.current?.click()}
                    disabled={reportLoading}
                  >
                    + Добавить фото
                  </button>
                ) : null}
              </div>
              {!reportModalReadOnly ? (
                <input
                  ref={reportPhotoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  className={styles.reportPhotoInput}
                  onChange={(event) => handleReportPhotoInput(event.target.files)}
                  disabled={reportLoading}
                />
              ) : null}
              {!reportModalReadOnly && existingReport?.photo_urls?.length ? (
                <p className={styles.modalPhotoNote}>
                  При обновлении отчёта нужно снова приложить все фото.
                </p>
              ) : null}
              {reportModalReadOnly && !(existingReport?.photo_urls?.length) ? (
                <p className={styles.modalPhotoNote}>Фото не приложены.</p>
              ) : null}
            </div>

            {reportError ? <p className={styles.modalError}>{reportError}</p> : null}

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.modalSecondaryButton}
                onClick={() => setReportModalResponseId(null)}
                disabled={reportLoading}
              >
                Закрыть
              </button>
              {!reportModalReadOnly ? (
              <button
                type="button"
                className={styles.modalPrimaryButton}
                disabled={reportLoading || !canSubmitReport}
                onClick={() => {
                  const id = reportModalResponseId;
                  if (id == null) return;
                  setReportLoading(true);
                  setReportError("");
                  void meVolunteerResponsesApi
                    .submitReport(id, {
                      content: reportText.trim(),
                      files: reportPhotos.map((photo) => photo.file),
                    })
                    .then(() => meVolunteerResponsesApi.getById(id))
                    .then((fresh) => {
                      const next = mapDetailDtoToUi(fresh as VolunteerResponseDetailDto);
                      if (next) {
                        setApiResponses((prev) => {
                          const rest = prev.filter((x) => x.id !== next.id);
                          return [next, ...rest];
                        });
                      }
                      setReportPhotos([]);
                      setReportModalResponseId(null);
                    })
                    .catch((err: unknown) => {
                      const msg = err instanceof Error ? err.message : String(err ?? "");
                      setReportError(msg.trim() || "Не удалось отправить отчёт.");
                    })
                    .finally(() => {
                      setReportLoading(false);
                      reloadList();
                    });
                }}
              >
                Отправить
              </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function formatDateRu(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString("ru-RU", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

function mapCardDtoToUi(item: VolunteerResponseCardDto): ResponseCard | null {
  if (!item || typeof item !== "object") return null;
  const id = Number(item.id);
  if (!Number.isFinite(id)) return null;
  const organizationName = item.organization_name?.trim() || "Организация";
  const orgId = typeof item.organization_id === "number" ? item.organization_id : null;
  const organizationHref = orgId ? `/catalog/organizations/${orgId}` : "/catalog/organizations";

  return {
    id,
    helpType: item.help_type_label?.trim() || item.help_type || "Отклик",
    organization: organizationName,
    organizationHref,
    title: item.title?.trim() || "Отклик",
    descriptionSnippet: item.description_snippet?.trim() || "",
    descriptionFull: null,
    dateLabel: item.created_at ? formatDateRu(item.created_at) : "",
    createdAt: item.created_at ?? null,
    status: mapVolunteerResponseStatus(String(item.status ?? ""), item.status_label),
    urgent: Boolean(item.is_urgent),
    canChat: item.can_chat !== false,
    chatThreadId: parseChatThreadId(item.chat_thread_id),
    reportAwaiting: Boolean(item.report_awaiting_org_review),
    canSendReport: Boolean(item.can_send_report),
    canViewReport: Boolean(item.can_view_report),
  };
}

function parseChatThreadId(raw: string | null | undefined): number | undefined {
  if (raw == null || raw === "") return undefined;
  const n = Number.parseInt(String(raw).trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function mapDetailDtoToUi(item: VolunteerResponseDetailDto): ResponseCard | null {
  const base = mapCardDtoToUi(item);
  if (!base) return null;
  const snippet = item.description_snippet?.trim() || base.descriptionSnippet;
  const fullRaw = item.help_request_description?.trim();
  const descriptionFull = (fullRaw || snippet || "").trim() || null;
  return {
    ...base,
    descriptionSnippet: snippet,
    descriptionFull,
  };
}
