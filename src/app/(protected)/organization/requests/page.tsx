"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";
import {
  addOrganizationRequest,
  getOrganizationCabinetEventName,
  getOrganizationRequests,
  updateOrganizationRequestStatus,
  type OrganizationRequestStatus,
} from "@/shared/lib/organizationCabinet";
import { getCurrentOrganizationAnimals, getOrganizationAnimalsEventName } from "@/shared/lib/organizationAnimals";
import { mergeApiFirstById } from "@/shared/lib/organizationPublicCabinet";
import { mergeApiAndLocalAnimals } from "@/shared/lib/organizationPublicWards";
import { useOrganizationPublicCabinetPayload } from "@/shared/lib/hooks/useOrganizationPublicCabinetPayload";

type HelpTypeOption = "Приютить" | "Накормить" | "Вылечить" | "Другое";

const initialState = {
  title: "",
  location: "",
  problemDescription: "",
  mediaUrl: "",
  helpType: "Приютить" as HelpTypeOption,
  customHelpType: "",
  urgency: "normal" as "normal" | "urgent",
  linkedAnimalId: "",
  needVolunteer: false,
  volunteerCompetencies: "",
};

const HELP_FILTERS = ["all", "Приютить", "Накормить", "Вылечить", "Другое"] as const;
type HelpFilter = (typeof HELP_FILTERS)[number];

const getRequestStatusLabel = (status: OrganizationRequestStatus) => {
  if (status === "published") return "опубликована";
  if (status === "in_progress") return "в работе";
  if (status === "closed") return "закрыта";
  return "черновик";
};

const normalizeHelpType = (value: string): HelpFilter => {
  if (value === "Приютить" || value === "Накормить" || value === "Вылечить") return value;
  return "Другое";
};

export default function OrganizationRequestsPage() {
  const apiPayload = useOrganizationPublicCabinetPayload();
  const [form, setForm] = useState(initialState);
  const [localRequests, setLocalRequests] = useState(getOrganizationRequests());
  const [localAnimals, setLocalAnimals] = useState(getCurrentOrganizationAnimals());
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [helpFilter, setHelpFilter] = useState<HelpFilter>("all");
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);

  useEffect(() => {
    const cabinetEventName = getOrganizationCabinetEventName();
    const animalsEventName = getOrganizationAnimalsEventName();
    const sync = () => {
      setLocalRequests(getOrganizationRequests());
      setLocalAnimals(getCurrentOrganizationAnimals());
    };
    sync();
    window.addEventListener(cabinetEventName, sync);
    window.addEventListener(animalsEventName, sync);
    return () => {
      window.removeEventListener(cabinetEventName, sync);
      window.removeEventListener(animalsEventName, sync);
    };
  }, []);

  useEffect(() => {
    const closeMenu = () => setOpenMenuId(null);
    window.addEventListener("click", closeMenu);
    return () => window.removeEventListener("click", closeMenu);
  }, []);

  const requests = useMemo(
    () => mergeApiFirstById(apiPayload.apiRequests, localRequests),
    [apiPayload.apiRequests, localRequests]
  );

  const animals = useMemo(
    () => mergeApiAndLocalAnimals(apiPayload.apiAnimals, localAnimals),
    [apiPayload.apiAnimals, localAnimals]
  );

  const visibleRequests = useMemo(() => {
    const query = search.trim().toLowerCase();
    return requests.filter((request) => {
      const bySearch =
        !query ||
        request.title.toLowerCase().includes(query) ||
        request.problemDescription.toLowerCase().includes(query) ||
        request.location.toLowerCase().includes(query);
      const byHelp = helpFilter === "all" || normalizeHelpType(request.helpType) === helpFilter;
      return bySearch && byHelp;
    });
  }, [helpFilter, requests, search]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.title.trim() || !form.problemDescription.trim()) return;

    const helpType = form.helpType === "Другое" ? form.customHelpType.trim() || "Другое" : form.helpType;

    addOrganizationRequest({
      title: form.title.trim(),
      location: form.location.trim(),
      problemDescription: form.problemDescription.trim(),
      mediaUrl: form.mediaUrl.trim() || undefined,
      helpType,
      urgency: form.urgency,
      linkedAnimalId: form.linkedAnimalId ? Number(form.linkedAnimalId) : undefined,
      needVolunteer: form.needVolunteer,
      volunteerCompetencies: form.needVolunteer ? form.volunteerCompetencies.trim() : "",
      status: "draft",
    });

    setForm(initialState);
    setCreateModalOpen(false);
  };

  const setStatus = (id: number, status: OrganizationRequestStatus) => {
    if (apiPayload.apiRequestIds.has(id)) return;
    updateOrganizationRequestStatus(id, status);
  };

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Заявки</h1>
            <button
              className={styles.addLink}
              type="button"
              onClick={() => {
                setForm(initialState);
                setCreateModalOpen(true);
              }}
            >
              Создать заявку
            </button>
          </div>

          <div className={styles.filters}>
            <input
              className={styles.searchInput}
              placeholder="Найти"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <div className={styles.statusFilters}>
              {HELP_FILTERS.map((filter) => (
                <button
                  key={filter}
                  type="button"
                  className={`${styles.filterButton} ${helpFilter === filter ? styles.filterButtonActive : ""}`}
                  onClick={() => setHelpFilter(filter)}
                >
                  {filter === "all" ? "Все" : filter}
                </button>
              ))}
            </div>
          </div>
        </div>

        {visibleRequests.length === 0 ? (
          <div className={styles.emptyState}>Заявок пока нет.</div>
        ) : (
          <section className={styles.list}>
            {visibleRequests.map((request) => {
              const linkedAnimal = request.linkedAnimalId
                ? animals.find((animal) => animal.id === request.linkedAnimalId)
                : null;
              const imageSrc = request.mediaUrl?.trim() || linkedAnimal?.primary_photo_url || "/cat-placeholder.jpg";

              return (
              <article key={request.id} className={styles.requestCard}>
                <div className={styles.cover}>
                  <img src={imageSrc} alt={request.title} />
                  {request.urgency === "urgent" ? <span className={styles.urgentBadge}>срочно</span> : null}
                </div>

                <div className={styles.requestBody}>
                  <div className={styles.cardActions}>
                    {!apiPayload.apiRequestIds.has(request.id) ? (
                      <>
                        <button
                          className={styles.menuButton}
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setOpenMenuId((prev) => (prev === request.id ? null : request.id));
                          }}
                        >
                          ⋮
                        </button>
                        {openMenuId === request.id ? (
                          <div className={styles.menuDropdown} onClick={(event) => event.stopPropagation()}>
                            <button type="button" onClick={() => setStatus(request.id, "published")}>
                              Публиковать
                            </button>
                            <button type="button" onClick={() => setStatus(request.id, "in_progress")}>
                              В работе
                            </button>
                            <button type="button" onClick={() => setStatus(request.id, "closed")}>
                              Закрыть
                            </button>
                          </div>
                        ) : null}
                      </>
                    ) : null}
                  </div>

                  <h3 className={styles.requestName}>{request.title}</h3>
                  <div className={styles.tags}>
                    <span>{request.helpType}</span>
                    {request.needVolunteer ? <span>Нужен волонтер</span> : null}
                    <span>{request.location || "Локация не указана"}</span>
                  </div>

                  <p className={styles.organizationLine}>{request.problemDescription}</p>
                  <p className={styles.metaLine}>Статус: {getRequestStatusLabel(request.status)}</p>
                </div>
              </article>
              );
            })}
          </section>
        )}
      </div>

      {isCreateModalOpen ? (
        <div className={styles.modalOverlay} onClick={() => setCreateModalOpen(false)}>
          <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
            <h2 className={styles.modalTitle}>Создать заявку</h2>

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
                  Тип помощи
                  <select
                    className={styles.select}
                    value={form.helpType}
                    onChange={(e) => setForm((prev) => ({ ...prev, helpType: e.target.value as HelpTypeOption }))}
                  >
                    <option value="Приютить">Приютить</option>
                    <option value="Накормить">Накормить</option>
                    <option value="Вылечить">Вылечить</option>
                    <option value="Другое">Другое</option>
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

              {form.helpType === "Другое" ? (
                <label className={styles.label}>
                  Свой тип помощи
                  <input
                    className={styles.input}
                    value={form.customHelpType}
                    onChange={(e) => setForm((prev) => ({ ...prev, customHelpType: e.target.value }))}
                    placeholder="Напишите вариант"
                  />
                </label>
              ) : null}

              <label className={styles.label}>
                Описание проблемы
                <textarea
                  className={styles.textarea}
                  value={form.problemDescription}
                  onChange={(e) => setForm((prev) => ({ ...prev, problemDescription: e.target.value }))}
                  required
                />
              </label>

              <label className={styles.label}>
                Прикрепить фото
                <input
                  className={styles.input}
                  value={form.mediaUrl}
                  onChange={(e) => setForm((prev) => ({ ...prev, mediaUrl: e.target.value }))}
                  placeholder="Ссылка на изображение"
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
                  Компетенции волонтера
                  <input
                    className={styles.input}
                    value={form.volunteerCompetencies}
                    onChange={(e) => setForm((prev) => ({ ...prev, volunteerCompetencies: e.target.value }))}
                  />
                </label>
              ) : null}

              <div className={styles.actions}>
                <button type="submit" className={styles.primaryButton}>
                  Создать
                </button>
                <button type="button" className={styles.secondaryButton} onClick={() => setForm(initialState)}>
                  Очистить форму
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  );
}
