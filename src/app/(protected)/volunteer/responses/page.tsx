"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import styles from "./page.module.css";
import {
  meVolunteerResponsesApi,
  type VolunteerResponseCardDto,
  type VolunteerReportOut,
  type VolunteerResponseDetailDto,
} from "@/shared/api/endpoints/meVolunteerResponses";
import { ResponseCardDescription } from "./responseCardDescription";
import { volunteerResponseStatusClassMap } from "@/shared/lib/volunteerResponseStatusClassMap";

export type ResponseStatus = "На рассмотрении" | "В работе" | "Завершено" | "Отменено" | "Отклонено";

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
  status: ResponseStatus;
  urgent?: boolean;
};

const filterOptions: { label: string; value: ResponseFilter }[] = [
  { label: "На рассмотрении", value: "На рассмотрении" },
  { label: "В работе", value: "В работе" },
  { label: "Завершенные", value: "Завершено" },
  { label: "Архив", value: "Архив" },
  { label: "Все", value: "Все" },
];

const statusClassMap: Record<ResponseStatus, string> = volunteerResponseStatusClassMap;

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
    const id = reportModalResponseId;
    if (id == null) {
      setExistingReport(null);
      setReportText("");
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

  const filteredResponses = useMemo(() => {
    if (activeFilter === "Все") {
      return apiResponses;
    }
    if (activeFilter === "Архив") {
      return apiResponses.filter((item) => item.status === "Отменено" || item.status === "Отклонено");
    }
    return apiResponses.filter((item) => item.status === activeFilter);
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
                  {item.status !== "Отменено" && item.status !== "Отклонено" ? (
                    <button type="button" className={styles.chatBtn}>
                      Чат
                    </button>
                  ) : null}
                  {item.status === "На рассмотрении" ? (
                    <>
                      <button type="button" className={styles.secondaryBtn} onClick={() => handleCancelResponse(item.id)}>
                        Отменить отклик
                      </button>
                    </>
                  ) : null}
                  {item.status === "В работе" ? (
                    <button type="button" className={styles.secondaryBtn} onClick={() => setReportModalResponseId(item.id)}>
                      Отправить отчет
                    </button>
                  ) : null}
                </div>
                <span className={`${styles.status} ${styles[statusClassMap[item.status]]}`}>{item.status}</span>
              </div>
            </article>
          ))}
        </section>
      </div>

      {reportModalResponseId != null ? (
        <div className={styles.modalOverlay} onClick={() => setReportModalResponseId(null)}>
          <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
            <h2 className={styles.modalTitle}>Отчет по отклику</h2>
            <p className={styles.modalHint}>
              Отправьте текст отчёта (минимум 10 символов по требованиям сервера). Если отчёт уже есть — можно обновить.
            </p>

            <label className={styles.modalLabel}>
              Текст отчета
              <textarea
                className={styles.modalTextarea}
                value={reportText}
                onChange={(event) => setReportText(event.target.value)}
                placeholder="Что было сделано, результат, детали"
                disabled={reportLoading}
              />
            </label>

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
              <button
                type="button"
                className={styles.modalPrimaryButton}
                disabled={reportLoading || reportText.trim().length < 10}
                onClick={() => {
                  const id = reportModalResponseId;
                  if (id == null) return;
                  setReportLoading(true);
                  setReportError("");
                  void meVolunteerResponsesApi
                    .submitReport(id, { content: reportText.trim() })
                    .then(() => meVolunteerResponsesApi.getById(id))
                    .then((fresh) => {
                      const next = mapDetailDtoToUi(fresh as VolunteerResponseDetailDto);
                      if (next) {
                        setApiResponses((prev) => {
                          const rest = prev.filter((x) => x.id !== next.id);
                          return [next, ...rest];
                        });
                      }
                      setReportModalResponseId(null);
                    })
                    .catch(() => setReportError("Не удалось отправить отчёт."))
                    .finally(() => {
                      setReportLoading(false);
                      reloadList();
                    });
                }}
              >
                Отправить
              </button>
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

function mapBackendStatus(raw: string, labelFallback?: string | null): ResponseStatus {
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
  if (s.includes("withdraw") || s === "withdrawn") return "Отменено";
  if (s.includes("reject")) return "Отклонено";
  if (s.includes("accept") || s.includes("progress") || s === "accepted") return "В работе";
  if (s.includes("done") || s.includes("complete") || s === "completed") return "Завершено";
  return "На рассмотрении";
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
    status: mapBackendStatus(String(item.status ?? ""), item.status_label),
    urgent: Boolean(item.is_urgent),
  };
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
