"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";
import { mergeApiAndLocalAnimals } from "@/shared/lib/organizationPublicWards";
import { useOrganizationPublicCabinetPayload } from "@/shared/lib/hooks/useOrganizationPublicCabinetPayload";
import type { Animal } from "@/shared/api/endpoints/animals";
import type { UrgentItem, UrgentRequestDetail } from "@/shared/api/endpoints/urgent";
import { fetchUrgentItemsAllPages, urgentApi } from "@/shared/api/endpoints/urgent";
import { getImageUrl } from "@/shared/api/client";
import {
  getUrgentHelpTypeShortTag,
  helpTypeToOrganizationRequestFilterCategory,
  type OrganizationRequestHelpFilterCategory,
} from "@/shared/lib/urgentHelpTypeLabels";
import { getCurrentOrganizationAnimals, getOrganizationAnimalsEventName } from "@/shared/lib/organizationAnimals";

type RequestsTab = "collections" | "volunteer_tasks";
const REQUEST_TABS: { key: RequestsTab; label: string }[] = [
  { key: "collections", label: "Сборы" },
  { key: "volunteer_tasks", label: "Задачи для волонтеров" },
];

const HELP_FILTERS = ["all", "Накормить", "Вылечить", "Другое"] as const;
type HelpFilter = (typeof HELP_FILTERS)[number];

const initialForm = () => ({
  title: "",
  location: "",
  problemDescription: "",
  helpType: "manual" as string,
  customHelpType: "",
  urgency: "normal" as "normal" | "urgent",
  linkedAnimalId: "",
  needVolunteer: false,
  volunteerCompetencies: "",
});

export default function OrganizationRequestsPage() {
  const apiPayload = useOrganizationPublicCabinetPayload();
  const [form, setForm] = useState(initialForm());
  const [localAnimals, setLocalAnimals] = useState(getCurrentOrganizationAnimals());
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [helpFilter, setHelpFilter] = useState<HelpFilter>("all");
  const [activeTab, setActiveTab] = useState<RequestsTab>("collections");
  const [items, setItems] = useState<UrgentItem[]>([]);
  const [catalogsLoaded, setCatalogsLoaded] = useState<{ help_types: { id: string; label: string }[] } | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [mutatingId, setMutatingId] = useState<number | null>(null);
  const [errorText, setErrorText] = useState("");
  const [editingRequestId, setEditingRequestId] = useState<number | null>(null);
  const [requestDetailById, setRequestDetailById] = useState<Record<number, UrgentRequestDetail>>({});

  const organizationId = apiPayload.organizationId;
  const orgNameNormalized = (
    apiPayload.listItem?.name?.trim().toLowerCase() ||
    (typeof window !== "undefined" ? localStorage.getItem("userName")?.trim().toLowerCase() : "") ||
    ""
  );

  const reload = useCallback(async () => {
    setErrorText("");
    setLoading(true);
    try {
      const [allItems, catalogs] = await Promise.all([
        fetchUrgentItemsAllPages(),
        urgentApi.getCatalogs().catch(() => null),
      ]);
      const mine =
        organizationId != null
          ? (allItems ?? []).filter((row) => row.organization_id === organizationId)
          : (allItems ?? []).filter(
              (row) =>
                !!orgNameNormalized && (row.organization_name ?? "").trim().toLowerCase() === orgNameNormalized
            );
      setItems(mine);
      if (catalogs) setCatalogsLoaded({ help_types: catalogs.help_types ?? [] });
      else setCatalogsLoaded(null);
    } catch (e) {
      setItems([]);
      setErrorText(e instanceof Error ? e.message : "Не удалось загрузить заявки.");
    } finally {
      setLoading(false);
    }
  }, [organizationId, orgNameNormalized]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const eventName = getOrganizationAnimalsEventName();
    const sync = () => setLocalAnimals(getCurrentOrganizationAnimals());
    sync();
    window.addEventListener(eventName, sync);
    return () => window.removeEventListener(eventName, sync);
  }, []);

  const animals = useMemo(
    () => mergeApiAndLocalAnimals(apiPayload.apiAnimals, localAnimals),
    [apiPayload.apiAnimals, localAnimals]
  );

  const visibleRequests = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((request) => {
      const description = `${request.description ?? ""}`;
      const city = `${request.city ?? ""}`;
      const bySearch =
        !query ||
        request.title.toLowerCase().includes(query) ||
        description.toLowerCase().includes(query) ||
        city.toLowerCase().includes(query);
      if (activeTab === "volunteer_tasks") {
        return bySearch;
      }
      const cat: OrganizationRequestHelpFilterCategory =
        helpTypeToOrganizationRequestFilterCategory(request.help_type);
      const byHelp = helpFilter === "all" || cat === helpFilter;
      return bySearch && byHelp;
    });
  }, [activeTab, helpFilter, items, search]);

  const tabRequests = useMemo(() => {
    if (activeTab === "volunteer_tasks") {
      return visibleRequests.filter((request) => request.volunteer_needed);
    }
    return visibleRequests.filter((request) => !request.volunteer_needed);
  }, [activeTab, visibleRequests]);

  const tabIdsKey = useMemo(
    () => [...new Set(tabRequests.map((r) => r.id))].sort((a, b) => a - b).join(","),
    [tabRequests]
  );

  useEffect(() => {
    if (loading) return;
    if (!tabIdsKey.length) {
      setRequestDetailById({});
      return;
    }
    const ids = tabIdsKey.split(",").map(Number).filter(Number.isFinite);
    let cancelled = false;
    void Promise.all(ids.map((id) => urgentApi.getById(id).catch(() => null))).then((rows) => {
      if (cancelled) return;
      const next: Record<number, UrgentRequestDetail> = {};
      rows.forEach((row, i) => {
        const id = ids[i];
        if (row && typeof id === "number") next[id] = row;
      });
      setRequestDetailById(next);
    });
    return () => {
      cancelled = true;
    };
  }, [loading, tabIdsKey]);

  const closeRequest = async (id: number) => {
    setMutatingId(id);
    try {
      await urgentApi.close(id);
      await reload();
    } catch {
      setErrorText("Не удалось закрыть заявку.");
    } finally {
      setMutatingId(null);
    }
  };

  const buildHelpSlug = () => {
    let helpSlug = form.helpType.trim();
    if (catalogsLoaded?.help_types?.length && !catalogsLoaded.help_types.some((h) => h.id === helpSlug)) {
      helpSlug = catalogsLoaded.help_types[0]?.id ?? "manual";
    }
    return helpSlug;
  };

  const buildCompetencies = () =>
    form.needVolunteer
      ? form.volunteerCompetencies
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.title.trim() || !form.problemDescription.trim()) return;

    const helpSlug = buildHelpSlug();
    const competencies = buildCompetencies();

    const payloadBase = {
      animal_id: form.linkedAnimalId ? Number(form.linkedAnimalId) : null,
      title: form.title.trim(),
      description: form.problemDescription.trim(),
      city: form.location.trim() || null,
      help_type: helpSlug,
      is_urgent: form.urgency === "urgent",
      volunteer_needed: form.needVolunteer,
      volunteer_competencies: competencies,
      volunteer_requirements: form.needVolunteer ? form.volunteerCompetencies.trim() || null : null,
    };

    setMutatingId(editingRequestId ?? -1);
    const done = () => {
      setForm(initialForm());
      setEditingRequestId(null);
      setCreateModalOpen(false);
      return reload();
    };

    if (editingRequestId != null) {
      void urgentApi
        .patch(editingRequestId, payloadBase)
        .then(() => done())
        .catch(() => setErrorText("Не удалось сохранить изменения заявки."))
        .finally(() => setMutatingId(null));
      return;
    }

    void urgentApi
      .create({
        ...payloadBase,
        is_published: false,
        status: "open",
      })
      .then(() => done())
      .catch(() => setErrorText("Не удалось создать заявку (проверьте авторизацию организации и поля формы)."))
      .finally(() => setMutatingId(null));
  };

  const resolveImage = (u: UrgentItem, linkedAnimal: Animal | null | undefined): string =>
    getImageUrl(u.primary_photo_url) ||
    getImageUrl(linkedAnimal?.primary_photo_url) ||
    "/cat-placeholder.jpg";

  const formatMoneyRub = (amount: number | null | undefined): string => {
    if (amount == null || !Number.isFinite(Number(amount))) return "";
    const n = Math.round(Number(amount));
    return `${new Intl.NumberFormat("ru-RU").format(n)} ₽`;
  };

  const collectionCategoryLabel = (request: UrgentItem) =>
    helpTypeToOrganizationRequestFilterCategory(request.help_type);

  const volunteerCardStatus = (detail: UrgentItem) => {
    const s = String(detail.status).toLowerCase();
    if (s === "closed") return { label: "Закрыта", tone: "closed" as const };
    if (s === "in_progress") return { label: "В работе", tone: "progress" as const };
    return { label: "Активна", tone: "active" as const };
  };

  const openCreateModal = (opts?: { presetVolunteer?: boolean }) => {
    setEditingRequestId(null);
    setForm({
      ...initialForm(),
      helpType: catalogsLoaded?.help_types?.[0]?.id ?? "manual",
      needVolunteer: opts?.presetVolunteer ?? false,
    });
    setCreateModalOpen(true);
  };

  const openEditRequest = async (id: number) => {
    setMutatingId(id);
    try {
      const d = await urgentApi.getById(id);
      setEditingRequestId(id);
      setForm({
        ...initialForm(),
        title: d.title,
        location: d.city ?? "",
        problemDescription: d.description,
        helpType: d.help_type,
        customHelpType: "",
        urgency: d.is_urgent ? "urgent" : "normal",
        linkedAnimalId: d.animal_id != null ? String(d.animal_id) : "",
        needVolunteer: d.volunteer_needed,
        volunteerCompetencies:
          (d.volunteer_competencies?.length ?? 0) > 0
            ? d.volunteer_competencies!.join(", ")
            : (d.volunteer_requirements ?? ""),
      });
      setCreateModalOpen(true);
    } catch {
      setErrorText("Не удалось загрузить заявку для редактирования.");
    } finally {
      setMutatingId(null);
    }
  };

  const formatVolunteerDeadline = (request: UrgentItem) =>
    request.deadline_label?.trim() || request.deadline_note?.trim() || null;

  const formatCreatedRu = (iso: string | undefined) => {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleDateString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch {
      return "";
    }
  };

  return (
    <main className={styles.page}>
      <div className={styles.container}>

        <div className={styles.toolbarBlock}>
          <div className={styles.tabsAndCreateRow}>
            <div className={styles.topTabs} role="tablist" aria-label="Разделы заявок">
              {REQUEST_TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.key}
                  className={`${styles.topTab} ${activeTab === tab.key ? styles.topTabActive : ""}`}
                  onClick={() => setActiveTab(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className={styles.headerCreateBtn}
              onClick={() =>
                openCreateModal({ presetVolunteer: activeTab === "volunteer_tasks" })
              }
            >
              + Создать заявку
            </button>
          </div>

          {activeTab === "collections" ? (
            <div className={styles.collectionsToolbar}>
              <label className={styles.collectionsSearchLabel}>
                <span className={styles.collectionsSearchIcon} aria-hidden />
                <input
                  className={styles.collectionsSearchInput}
                  placeholder="Найти"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  aria-label="Поиск заявок"
                />
              </label>
              <div className={styles.filterSelectWrap}>
                <select
                  className={styles.helpFilterSelect}
                  value={helpFilter}
                  onChange={(event) => setHelpFilter(event.target.value as HelpFilter)}
                  aria-label="Фильтр по типу помощи"
                >
                  {HELP_FILTERS.map((filter) => (
                    <option key={filter} value={filter}>
                      {filter === "all" ? "Все" : filter}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <div className={styles.volunteerSearchRow}>
              <label className={styles.volunteerSearchLabel}>
                <span className={styles.volunteerSearchIcon} aria-hidden />
                <input
                  className={styles.volunteerSearchInput}
                  placeholder="Найти"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  aria-label="Поиск задач для волонтёров"
                />
              </label>
            </div>
          )}
        </div>

        {errorText ? <p style={{ color: "#a33" }}>{errorText}</p> : null}
        {loading ? <div className={styles.emptyState}>Загрузка…</div> : null}

        {!loading && tabRequests.length === 0 ? (
          <div className={styles.emptyState}>Заявок пока нет.</div>
        ) : (
          !loading && (
            <section className={styles.listVertical}>
              {tabRequests.map((request) => {
                const linkedAnimal = request.animal_id
                  ? animals.find((animal) => animal.id === request.animal_id)
                  : undefined;
                const detail = requestDetailById[request.id];

                if (activeTab === "volunteer_tasks") {
                  const extra = detail;
                  const vStatus = volunteerCardStatus(request);
                  const deadlineText = formatVolunteerDeadline(request);
                  const createdText = formatCreatedRu(extra?.created_at);
                  const animalName =
                    request.animal_name?.trim() ||
                    linkedAnimal?.name?.trim() ||
                    (request.animal_id != null ? "Подопечный" : "");

                  return (
                    <article key={request.id} className={styles.volunteerTaskCard}>
                      <div className={styles.volunteerCardTop}>
                        <span className={styles.volunteerHelpTag}>{getUrgentHelpTypeShortTag(request.help_type)}</span>
                        <div className={styles.volunteerCardTopRight}>
                          {request.is_urgent ? <span className={styles.volunteerUrgentTag}>срочно</span> : null}
                        </div>
                      </div>

                      <div className={styles.cardTitleRow}>
                        <h2 className={styles.volunteerTitle}>{request.title}</h2>
                        <span
                          className={
                            vStatus.tone === "active"
                              ? styles.volunteerStatusActive
                              : vStatus.tone === "progress"
                                ? styles.volunteerStatusProgress
                                : styles.volunteerStatusClosed
                          }
                        >
                          {vStatus.label}
                        </span>
                      </div>

                      {animalName ? (
                        <div className={styles.cardAnimalRow}>
                          <img
                            className={styles.cardAnimalAvatar}
                            src={resolveImage(request, linkedAnimal)}
                            alt=""
                          />
                          <span className={styles.cardAnimalName}>{animalName}</span>
                        </div>
                      ) : null}

                      <div className={styles.volunteerDescription}>{request.description}</div>

                      {extra?.address?.trim() ? (
                        <div className={styles.volunteerSection}>
                          <p className={styles.volunteerSectionLabel}>Маршрут</p>
                          <p className={styles.volunteerSectionText}>{extra.address.trim()}</p>
                        </div>
                      ) : null}

                      {extra?.volunteer_requirements?.trim() ? (
                        <div className={styles.volunteerSection}>
                          <p className={styles.volunteerSectionLabel}>Что нужно сделать</p>
                          <p className={styles.volunteerSectionText}>{extra.volunteer_requirements.trim()}</p>
                        </div>
                      ) : null}

                      {deadlineText ? (
                        <p className={styles.volunteerDeadlineRow}>
                          <img src="/clock.svg" alt="" className={styles.volunteerClockIcon} aria-hidden />
                          {deadlineText}
                        </p>
                      ) : null}

                      <div className={styles.volunteerFooter}>
                        <div className={styles.volunteerFooterActions}>
                          <button
                            type="button"
                            className={styles.volunteerEditBtn}
                            disabled={mutatingId === request.id}
                            onClick={() => void openEditRequest(request.id)}
                          >
                            Редактировать заявку
                          </button>
                          <button
                            type="button"
                            className={styles.volunteerCloseLink}
                            disabled={mutatingId === request.id || String(request.status).toLowerCase() === "closed"}
                            onClick={() => void closeRequest(request.id)}
                          >
                            Закрыть заявку
                          </button>
                        </div>
                        {createdText ? (
                          <p className={styles.volunteerCreated}>Дата создания заявки {createdText}</p>
                        ) : null}
                      </div>
                    </article>
                  );
                }

                const cStatus = volunteerCardStatus(request);
                const createdCollect = formatCreatedRu(detail?.created_at);
                const goalText = formatMoneyRub(request.target_amount);
                const animalNameColl =
                  request.animal_name?.trim() ||
                  linkedAnimal?.name?.trim() ||
                  (request.animal_id != null ? "Подопечный" : "");

                return (
                  <article key={request.id} className={styles.volunteerTaskCard}>
                    <div className={styles.collectionCardHeader}>
                      <div className={styles.collectionHeaderMain}>
                        <span className={styles.collectionCategoryTag}>{collectionCategoryLabel(request)}</span>
                        <h2 className={`${styles.volunteerTitle} ${styles.collectionTitleOnly}`}>{request.title}</h2>
                      </div>
                      <div className={styles.volunteerCardTopRight}>
                        {request.is_urgent ? <span className={styles.volunteerUrgentTag}>срочно</span> : null}
                        <span
                          className={
                            cStatus.tone === "active"
                              ? styles.volunteerStatusActive
                              : cStatus.tone === "progress"
                                ? styles.volunteerStatusProgress
                                : styles.volunteerStatusClosed
                          }
                        >
                          {cStatus.label}
                        </span>
                      </div>
                    </div>

                    {animalNameColl ? (
                      <div className={styles.cardAnimalRow}>
                        <img
                          className={styles.cardAnimalAvatar}
                          src={resolveImage(request, linkedAnimal)}
                          alt=""
                        />
                        <span className={styles.cardAnimalName}>{animalNameColl}</span>
                      </div>
                    ) : null}

                    {goalText ? (
                      <p className={styles.collectionGoalLine}>Цель сбора: {goalText}</p>
                    ) : (
                      <p className={styles.collectionGoalMuted}>Цель сбора не указана</p>
                    )}

                    <div className={styles.volunteerFooter}>
                      <div className={styles.volunteerFooterActions}>
                        <button
                          type="button"
                          className={styles.volunteerEditBtn}
                          disabled={mutatingId === request.id}
                          onClick={() => void openEditRequest(request.id)}
                        >
                          Редактировать заявку
                        </button>
                        <button
                          type="button"
                          className={styles.volunteerCloseLink}
                          disabled={mutatingId === request.id || String(request.status).toLowerCase() === "closed"}
                          onClick={() => void closeRequest(request.id)}
                        >
                          Закрыть заявку
                        </button>
                      </div>
                      {createdCollect ? (
                        <p className={styles.volunteerCreated}>Дата создания заявки {createdCollect}</p>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </section>
          )
        )}
      </div>

      {isCreateModalOpen ? (
        <div
          className={styles.modalOverlay}
          onClick={() => {
            setCreateModalOpen(false);
            setEditingRequestId(null);
          }}
        >
          <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
            <h2 className={styles.modalTitle}>
              {editingRequestId != null ? "Редактировать заявку" : "Создать заявку"}
            </h2>

            <form onSubmit={handleSubmit} className={styles.form}>
              <div className={styles.formGrid}>
                <label className={styles.label}>
                  Заголовок
                  <input
                    className={styles.input}
                    value={form.title}
                    onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                    required
                  />
                </label>

                <label className={styles.label}>
                  Локация
                  <input
                    className={styles.input}
                    value={form.location}
                    onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))}
                  />
                </label>

                <label className={styles.label}>
                  Тип помощи (код API)
                  <select
                    className={styles.select}
                    value={form.helpType}
                    onChange={(e) => setForm((prev) => ({ ...prev, helpType: e.target.value }))}
                  >
                    {(catalogsLoaded?.help_types?.length
                      ? catalogsLoaded.help_types
                      : [
                          { id: "financial", label: "Финансовая помощь" },
                          { id: "foster", label: "Передержка" },
                          { id: "manual", label: "Помощь руками" },
                          { id: "auto", label: "Автопомощь" },
                          { id: "medical", label: "Медицина" },
                          { id: "food", label: "Корм" },
                        ]
                    ).map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className={styles.label}>
                  Привязать к животному
                  <select
                    className={styles.select}
                    value={form.linkedAnimalId}
                    onChange={(e) => setForm((prev) => ({ ...prev, linkedAnimalId: e.target.value }))}
                  >
                    <option value="">Без привязки</option>
                    {animals.map((animal) => (
                      <option key={animal.id} value={animal.id}>
                        {animal.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className={styles.label}>
                Описание проблемы
                <textarea
                  className={styles.textarea}
                  value={form.problemDescription}
                  onChange={(e) => setForm((prev) => ({ ...prev, problemDescription: e.target.value }))}
                  required
                  minLength={10}
                />
              </label>

              <label className={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={form.urgency === "urgent"}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      urgency: e.target.checked ? "urgent" : "normal",
                    }))
                  }
                />
                Срочный случай
              </label>

              <label className={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={form.needVolunteer}
                  onChange={(e) => setForm((prev) => ({ ...prev, needVolunteer: e.target.checked }))}
                />
                Нужен волонтер
              </label>

              {form.needVolunteer ? (
                <label className={styles.label}>
                  Компетенции волонтера (через запятую)
                  <input
                    className={styles.input}
                    value={form.volunteerCompetencies}
                    onChange={(e) => setForm((prev) => ({ ...prev, volunteerCompetencies: e.target.value }))}
                  />
                </label>
              ) : null}

              <div className={styles.actions}>
                <button className={styles.primaryButton} type="submit" disabled={mutatingId !== null}>
                  {mutatingId !== null
                    ? editingRequestId != null
                      ? "Сохранение…"
                      : "Создание…"
                    : editingRequestId != null
                      ? "Сохранить"
                      : "Создать черновик"}
                </button>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  disabled={mutatingId !== null}
                  onClick={() =>
                    editingRequestId != null ? void openEditRequest(editingRequestId) : setForm(initialForm())
                  }
                >
                  {editingRequestId != null ? "Сбросить к версии с сервера" : "Очистить форму"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  );
}
