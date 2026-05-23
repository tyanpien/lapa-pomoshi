"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchOrgHelpRequestsAllPages, meOrganizationApi } from "@/shared/api/endpoints/meOrganization";
import styles from "./page.module.css";
import { mergeApiAndLocalAnimals } from "@/shared/lib/organizationPublicWards";
import { useOrganizationPublicCabinetPayload } from "@/shared/lib/hooks/useOrganizationPublicCabinetPayload";
import type { Animal } from "@/shared/api/endpoints/animals";
import type { UrgentItem, UrgentRequestDetail } from "@/shared/api/endpoints/urgent";
import { fetchUrgentItemsAllPages, urgentApi } from "@/shared/api/endpoints/urgent";
import { resolveAnimalAvatarSrc } from "@/shared/api/client";
import {
  getUrgentHelpTypeShortTag,
  helpTypeToOrganizationRequestFilterCategory,
  type OrganizationRequestHelpFilterCategory,
} from "@/shared/lib/urgentHelpTypeLabels";
import { humanizeHelpTypeList } from "@/shared/lib/urgentHelpTypeLabels";
import { getCurrentOrganizationAnimals, getOrganizationAnimalsEventName } from "@/shared/lib/organizationAnimals";
import {
  mapMeHelpRequestToUrgentDetail,
  mapMeHelpRequestToUrgentItem,
  unwrapApiList,
} from "@/shared/lib/organizationMeCabinet";
import { getOrganizationProfile } from "@/shared/lib/organizationCabinet";
import {
  isCollectionRequest,
  isVolunteerTaskRequest,
  parseVolunteerTaskDescription,
} from "@/shared/lib/helpRequestType";
import {
  CreateRequestModal,
  emptyCreateForm,
  type CreateRequestFormState,
  type RequestKind,
} from "./components/CreateRequestModal";

function extractBankAccountDigits(value: string | null | undefined): string {
  if (!value?.trim()) return "";
  return value.replace(/\D/g, "");
}

function resolveOrgBankAccountDigits(publicPageBankAccount?: string | null): string {
  const fromProfile = getOrganizationProfile().bankAccount;
  const raw = fromProfile.trim() || (publicPageBankAccount ?? "").trim();
  return extractBankAccountDigits(raw);
}

type RequestsTab = "collections" | "volunteer_tasks";
const REQUEST_TABS: { key: RequestsTab; label: string }[] = [
  { key: "collections", label: "Сборы" },
  { key: "volunteer_tasks", label: "Задачи для волонтеров" },
];

const HELP_FILTERS = ["all", "Накормить", "Вылечить", "Другое"] as const;
type HelpFilter = (typeof HELP_FILTERS)[number];

const DEFAULT_REQUEST_STATUS_OPTIONS: { id: string; label: string }[] = [
  { id: "open", label: "Активна" },
  { id: "in_progress", label: "В работе" },
  { id: "closed", label: "Закрыта" },
];

function helpTypeToCollectionSlug(helpType: string): string {
  const h = helpType.trim().toLowerCase();
  if (h === "food" || h === "feed") return "food";
  if (h === "medical") return "medical";
  return "financial";
}

function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return "";
  }
}

export default function OrganizationRequestsPage() {
  const apiPayload = useOrganizationPublicCabinetPayload();
  const [form, setForm] = useState<CreateRequestFormState>(() =>
    emptyCreateForm()
  );
  const [modalKind, setModalKind] = useState<RequestKind | null>(null);
  const [localAnimals, setLocalAnimals] = useState(getCurrentOrganizationAnimals());
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [helpFilter, setHelpFilter] = useState<HelpFilter>("all");
  const [activeTab, setActiveTab] = useState<RequestsTab>("collections");
  const [items, setItems] = useState<UrgentItem[]>([]);
  const [catalogsLoaded, setCatalogsLoaded] = useState<{
    help_types: { id: string; label: string }[];
    statuses: { id: string; label: string }[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [mutatingId, setMutatingId] = useState<number | null>(null);
  const [errorText, setErrorText] = useState("");
  const [editingRequestId, setEditingRequestId] = useState<number | null>(null);
  const [requestDetailById, setRequestDetailById] = useState<Record<number, UrgentRequestDetail>>({});
  const [meHelpRawById, setMeHelpRawById] = useState<Record<number, Record<string, unknown>>>({});

  const organizationId = apiPayload.organizationId;
  const useMeCabinet = apiPayload.dataSource === "me" && organizationId != null;
  const orgDisplayName = useMemo(
    () =>
      apiPayload.listItem?.name?.trim() ||
      apiPayload.publicPage?.hero.name?.trim() ||
      (typeof window !== "undefined" ? localStorage.getItem("userName")?.trim() : "") ||
      "Организация",
    [apiPayload.listItem?.name, apiPayload.publicPage?.hero.name]
  );
  const orgNameNormalized = (
    apiPayload.listItem?.name?.trim().toLowerCase() ||
    (typeof window !== "undefined" ? localStorage.getItem("userName")?.trim().toLowerCase() : "") ||
    ""
  );

  const orgBankAccountDigits = useMemo(
    () => resolveOrgBankAccountDigits(apiPayload.publicPage?.about?.bank_account),
    [apiPayload.publicPage?.about?.bank_account]
  );

  const reload = useCallback(async () => {
    setErrorText("");
    setLoading(true);
    try {
      if (useMeCabinet && organizationId != null) {
        const rows = unwrapApiList<Record<string, unknown>>(
          await fetchOrgHelpRequestsAllPages()
        );
        const byId: Record<number, Record<string, unknown>> = {};
        for (const r of rows) {
          const rid = typeof r.id === "number" ? r.id : null;
          if (rid != null) byId[rid] = r;
        }
        setMeHelpRawById(byId);
        setItems(rows.map((r) => mapMeHelpRequestToUrgentItem(r, organizationId, orgDisplayName)));
        const catalogs = await urgentApi.getCatalogs().catch(() => null);
        if (catalogs) {
          setCatalogsLoaded({
            help_types: catalogs.help_types ?? [],
            statuses: catalogs.statuses ?? [],
          });
        } else setCatalogsLoaded(null);
        return;
      }

      setMeHelpRawById({});
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
      if (catalogs) {
        setCatalogsLoaded({
          help_types: catalogs.help_types ?? [],
          statuses: catalogs.statuses ?? [],
        });
      } else setCatalogsLoaded(null);
    } catch (e) {
      setItems([]);
      setErrorText(e instanceof Error ? e.message : "Не удалось загрузить заявки.");
    } finally {
      setLoading(false);
    }
  }, [organizationId, orgNameNormalized, orgDisplayName, useMeCabinet]);

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
    const filtered =
      activeTab === "volunteer_tasks"
        ? visibleRequests.filter((request) =>
            isVolunteerTaskRequest(request, meHelpRawById[request.id])
          )
        : visibleRequests.filter((request) =>
            isCollectionRequest(request, meHelpRawById[request.id])
          );

    return [...filtered].sort((a, b) => {
      const aUrgent = a.is_urgent ? 1 : 0;
      const bUrgent = b.is_urgent ? 1 : 0;
      if (aUrgent !== bUrgent) return bUrgent - aUrgent;
      return b.id - a.id;
    });
  }, [activeTab, visibleRequests, meHelpRawById]);

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
    if (useMeCabinet && organizationId != null) {
      const next: Record<number, UrgentRequestDetail> = {};
      for (const id of ids) {
        const raw = meHelpRawById[id];
        if (raw) next[id] = mapMeHelpRequestToUrgentDetail(raw, organizationId, orgDisplayName);
      }
      setRequestDetailById(next);
      return () => {
        cancelled = true;
      };
    }
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
  }, [loading, tabIdsKey, useMeCabinet, organizationId, orgDisplayName, meHelpRawById]);

  const statusCatalogRows =
    catalogsLoaded?.statuses?.length ? catalogsLoaded.statuses : DEFAULT_REQUEST_STATUS_OPTIONS;

  const patchRequestStatus = useCallback(
    async (requestId: number, nextStatus: string) => {
      setMutatingId(requestId);
      setErrorText("");
      try {
        if (useMeCabinet) {
          await meOrganizationApi.patchHelpRequest(requestId, { status: nextStatus });
        } else {
          await urgentApi.patch(requestId, { status: nextStatus });
        }
        await reload();
      } catch {
        setErrorText("Не удалось обновить статус заявки.");
      } finally {
        setMutatingId(null);
      }
    },
    [reload, useMeCabinet]
  );

  const renderStatusSelect = (request: UrgentItem) => {
    const current = String(request.status ?? "").trim().toLowerCase();
    const opts = statusCatalogRows.some((o) => o.id.toLowerCase() === current)
      ? statusCatalogRows
      : [{ id: String(request.status ?? "open"), label: String(request.status ?? "open") }, ...statusCatalogRows];
    const matched = opts.find((o) => o.id.toLowerCase() === current) ?? opts[0];
    const value = matched?.id ?? "open";
    const toneClass =
      current === "closed"
        ? styles.volunteerStatusClosed
        : current === "in_progress"
          ? styles.volunteerStatusProgress
          : styles.volunteerStatusActive;

    return (
      <select
        className={`${styles.cardStatusSelect} ${toneClass}`}
        aria-label="Статус заявки"
        value={value}
        disabled={mutatingId === request.id}
        onChange={(event) => void patchRequestStatus(request.id, event.target.value)}
      >
        {opts.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    );
  };

  const closeRequest = async (id: number) => {
    setMutatingId(id);
    try {
      if (useMeCabinet) {
        await meOrganizationApi.closeHelpRequest(id);
      } else {
        await urgentApi.close(id);
      }
      await reload();
    } catch {
      setErrorText("Не удалось закрыть заявку.");
    } finally {
      setMutatingId(null);
    }
  };

  const patchForm = (patch: Partial<CreateRequestFormState>) => {
    setForm((prev) => ({ ...prev, ...patch }));
  };

  const closeCreateModal = () => {
    setCreateModalOpen(false);
    setEditingRequestId(null);
    setModalKind(null);
    setForm(emptyCreateForm(catalogsLoaded?.help_types?.[0]?.id ?? "manual"));
  };

  const formatSaveError = (e: unknown, action: "создать" | "сохранить") => {
    const msg = e instanceof Error ? e.message : "ошибка запроса";
    if (msg.includes("500")) {
      if (action === "создать") {
        return (
          "Сервер вернул ошибку 500, но заявка могла уже сохраниться — проверьте список. " +
          "Не нажимайте «Опубликовать» или «Сохранить» ещё раз: каждое нажатие может создать новую копию в базе. " +
          "Повторяющиеся «Перевозка» с разными датами — это отдельные записи (демо-данные и такие сбои)."
        );
      }
      return `Сервер вернул ошибку 500. Изменения могли сохраниться — обновите страницу.`;
    }
    return `Не удалось ${action} заявку: ${msg}`;
  };

  const saveRequest = ({ kind, publish }: { kind: RequestKind; publish: boolean }) => {
    if (!form.title.trim() || form.problemDescription.trim().length < 10) {
      setErrorText("Заполните заголовок и описание (не менее 10 символов).");
      return;
    }
    if (publish && !form.linkedAnimalId) {
      setErrorText("Выберите подопечного для публикации заявки.");
      return;
    }

    const targetRaw = form.targetAmount.trim().replace(/\s/g, "").replace(",", ".");
    const targetAmount =
      kind === "collection" && targetRaw ? Number(targetRaw) : null;

    let helpSlug =
      kind === "collection" ? form.collectionHelpType.trim() : form.helpType.trim();
    if (
      kind === "volunteer" &&
      catalogsLoaded?.help_types?.length &&
      !catalogsLoaded.help_types.some((h) => h.id === helpSlug)
    ) {
      helpSlug = catalogsLoaded.help_types[0]?.id ?? "manual";
    }

    const deadlineIso = form.deadlineAt
      ? new Date(form.deadlineAt).toISOString()
      : null;

    const payloadBase = {
      animal_id: form.linkedAnimalId ? Number(form.linkedAnimalId) : null,
      title: form.title.trim(),
      description: form.problemDescription.trim(),
      help_type: helpSlug,
      is_urgent: form.isUrgent,
      volunteer_needed: kind === "volunteer",
      volunteer_competencies: [] as string[],
      volunteer_requirements:
        kind === "collection" && form.requisites.trim()
          ? form.requisites.trim()
          : null,
      target_amount:
        kind === "collection" && targetAmount != null && Number.isFinite(targetAmount)
          ? targetAmount
          : null,
      address: kind === "volunteer" ? form.location.trim() || null : null,
      city: kind === "volunteer" ? form.location.trim() || null : null,
      deadline_at: kind === "volunteer" ? deadlineIso : null,
      is_published: publish,
      status: "open",
    };

    setMutatingId(editingRequestId ?? -1);
    setErrorText("");

    const done = () => {
      setActiveTab(kind === "volunteer" ? "volunteer_tasks" : "collections");
      closeCreateModal();
      return reload();
    };

    if (useMeCabinet) {
      if (editingRequestId != null) {
        void meOrganizationApi
          .patchHelpRequest(editingRequestId, payloadBase)
          .then(() => done())
          .catch((e) =>
            setErrorText(
              `Не удалось сохранить изменения заявки: ${e instanceof Error ? e.message : "ошибка запроса"}`
            )
          )
          .finally(() => setMutatingId(null));
        return;
      }
      void meOrganizationApi
        .createHelpRequest(payloadBase)
        .then(() => done())
        .catch(async (e) => {
          await reload().catch(() => {});
          setErrorText(formatSaveError(e, "создать"));
        })
        .finally(() => setMutatingId(null));
      return;
    }

    if (editingRequestId != null) {
      void urgentApi
        .patch(editingRequestId, payloadBase)
        .then(() => done())
        .catch((e) =>
          setErrorText(
            `Не удалось сохранить изменения заявки: ${e instanceof Error ? e.message : "ошибка запроса"}`
          )
        )
        .finally(() => setMutatingId(null));
      return;
    }

    void urgentApi
      .create(payloadBase)
      .then(() => done())
      .catch(async (e) => {
        await reload().catch(() => {});
        setErrorText(formatSaveError(e, "создать"));
      })
      .finally(() => setMutatingId(null));
  };

  const resolveImage = (u: UrgentItem, linkedAnimal: Animal | null | undefined): string =>
    resolveAnimalAvatarSrc(
      u.primary_photo_url,
      linkedAnimal?.primary_photo_url,
      linkedAnimal?.photo_urls?.[0]
    );

  const formatMoneyRub = (amount: number | null | undefined): string => {
    if (amount == null || !Number.isFinite(Number(amount))) return "";
    const n = Math.round(Number(amount));
    return `${new Intl.NumberFormat("ru-RU").format(n)} ₽`;
  };

  const collectionCategoryLabel = (request: UrgentItem) =>
    helpTypeToOrganizationRequestFilterCategory(request.help_type);

  const openCreateModal = () => {
    setEditingRequestId(null);
    setModalKind(null);
    setErrorText("");
    setForm({
      ...emptyCreateForm(catalogsLoaded?.help_types?.[0]?.id ?? "manual"),
      requisites: resolveOrgBankAccountDigits(apiPayload.publicPage?.about?.bank_account),
    });
    setCreateModalOpen(true);
  };

  const fillFormFromDetail = (d: UrgentRequestDetail, kind: RequestKind) => {
    setForm({
      ...emptyCreateForm(catalogsLoaded?.help_types?.[0]?.id ?? "manual"),
      title: d.title,
      isUrgent: d.is_urgent,
      linkedAnimalId: d.animal_id != null ? String(d.animal_id) : "",
      collectionHelpType: helpTypeToCollectionSlug(d.help_type),
      targetAmount:
        d.target_amount != null && Number.isFinite(Number(d.target_amount))
          ? String(Math.round(Number(d.target_amount)))
          : "",
      requisites:
        extractBankAccountDigits(d.volunteer_requirements) ||
        orgBankAccountDigits ||
        resolveOrgBankAccountDigits(apiPayload.publicPage?.about?.bank_account),
      problemDescription: d.description,
      helpType: d.help_type,
      location: d.address?.trim() || d.city?.trim() || "",
      deadlineAt: toDatetimeLocalValue(d.deadline_at),
    });
    setModalKind(kind);
  };

  const openEditRequest = async (id: number) => {
    setMutatingId(id);
    try {
      if (useMeCabinet && organizationId != null) {
        const raw = meHelpRawById[id];
        if (!raw) {
          setErrorText("Не удалось загрузить заявку для редактирования.");
          return;
        }
        const d = mapMeHelpRequestToUrgentDetail(raw, organizationId, orgDisplayName);
        setEditingRequestId(id);
        fillFormFromDetail(d, d.volunteer_needed ? "volunteer" : "collection");
        setCreateModalOpen(true);
        return;
      }
      const d = await urgentApi.getById(id);
      setEditingRequestId(id);
      fillFormFromDetail(d, d.volunteer_needed ? "volunteer" : "collection");
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
            <button type="button" className={styles.headerCreateBtn} onClick={openCreateModal}>
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
                  ? animals.find((animal) => Number(animal.id) === Number(request.animal_id))
                  : undefined;
                const detail = requestDetailById[request.id];
                const animalDisplayName =
                  request.animal_name?.trim() ||
                  linkedAnimal?.name?.trim() ||
                  (request.animal_id != null ? "Подопечный" : "");

                if (activeTab === "volunteer_tasks") {
                  const extra = detail;
                  const deadlineText = formatVolunteerDeadline(request);
                  const createdText = formatCreatedRu(extra?.created_at);
                  const descParts = parseVolunteerTaskDescription(request.description ?? "");
                  const hasStructuredBody = Boolean(
                    descParts.route || descParts.whatToDo || descParts.extra
                  );
                  const routeText =
                    descParts.route?.trim() || extra?.address?.trim() || null;
                  const whatToDoText =
                    descParts.whatToDo?.trim() ||
                    extra?.volunteer_requirements?.trim() ||
                    null;
                  const extraText = descParts.extra?.trim() || null;
                  const routeLines = routeText
                    ? routeText
                        .split("\n")
                        .map((line) => line.trim())
                        .filter(Boolean)
                    : [];

                  return (
                    <article key={request.id} className={styles.volunteerTaskCard}>
                      <div className={styles.volunteerCardHeader}>
                        <span className={styles.volunteerHelpTag}>{getUrgentHelpTypeShortTag(request.help_type)}</span>
                        <h2 className={styles.volunteerTitle}>{request.title}</h2>
                        <div className={styles.volunteerCardTopRight}>
                          {request.is_urgent ? <span className={styles.volunteerUrgentTag}>срочно</span> : null}
                          {renderStatusSelect(request)}
                        </div>
                      </div>

                      {animalDisplayName ? (
                        <div className={styles.cardAnimalRow}>
                          <img
                            className={styles.cardAnimalAvatar}
                            src={resolveImage(request, linkedAnimal)}
                            alt=""
                          />
                          <span className={styles.cardAnimalName}>{animalDisplayName}</span>
                        </div>
                      ) : null}

                      {descParts.intro ? (
                        <p className={styles.volunteerDescription}>{descParts.intro}</p>
                      ) : !hasStructuredBody ? (
                        <p className={styles.volunteerDescription}>{request.description}</p>
                      ) : null}

                      {routeLines.length > 0 ? (
                        <div className={styles.volunteerSection}>
                          <p className={styles.volunteerSectionLabel}>Маршрут</p>
                          <ul className={styles.volunteerRouteList}>
                            {routeLines.map((line) => (
                              <li key={line} className={styles.volunteerRouteItem}>
                                {line.replace(/^[•\-]\s*/, "")}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}

                      {whatToDoText ? (
                        <div className={styles.volunteerSection}>
                          <p className={styles.volunteerSectionLabel}>Что нужно сделать</p>
                          <p className={styles.volunteerSectionText}>
                            {humanizeHelpTypeList(whatToDoText)}
                          </p>
                        </div>
                      ) : null}

                      {extraText ? (
                        <div className={styles.volunteerSection}>
                          <p className={styles.volunteerSectionLabel}>Дополнительно</p>
                          <p className={styles.volunteerSectionText}>{extraText}</p>
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

                const createdCollect = formatCreatedRu(detail?.created_at);
                const goalText = formatMoneyRub(request.target_amount);

                return (
                  <article key={request.id} className={styles.volunteerTaskCard}>
                    <div className={styles.collectionCardHeader}>
                      <div className={styles.collectionHeaderMain}>
                        <span className={styles.collectionCategoryTag}>{collectionCategoryLabel(request)}</span>
                        <h2 className={`${styles.volunteerTitle} ${styles.collectionTitleOnly}`}>{request.title}</h2>
                      </div>
                      <div className={styles.volunteerCardTopRight}>
                        {request.is_urgent ? <span className={styles.volunteerUrgentTag}>срочно</span> : null}
                        {renderStatusSelect(request)}
                      </div>
                    </div>

                    {animalDisplayName ? (
                      <div className={styles.cardAnimalRow}>
                        <img
                          className={styles.cardAnimalAvatar}
                          src={resolveImage(request, linkedAnimal)}
                          alt=""
                        />
                        <span className={styles.cardAnimalName}>{animalDisplayName}</span>
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
        <CreateRequestModal
          animals={animals}
          helpTypeOptions={catalogsLoaded?.help_types}
          editingId={editingRequestId}
          initialKind={modalKind}
          initialStep={editingRequestId != null && modalKind ? modalKind : undefined}
          form={form}
          onFormChange={patchForm}
          defaultBankAccountDigits={
            orgBankAccountDigits || resolveOrgBankAccountDigits(apiPayload.publicPage?.about?.bank_account)
          }
          saving={mutatingId !== null}
          errorText={errorText || undefined}
          onClose={closeCreateModal}
          onSave={saveRequest}
        />
      ) : null}
    </main>
  );
}
