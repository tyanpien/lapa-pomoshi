"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";
import { eventsApi, type EventItem } from "@/shared/api/endpoints/events";
import { meOrganizationApi } from "@/shared/api/endpoints/meOrganization";
import { unwrapApiList } from "@/shared/lib/organizationMeCabinet";
import { getOrganizationCabinetEventName } from "@/shared/lib/organizationCabinet";
import { useUser } from "@/shared/lib/hooks/useUser";

function notifyCabinetUpdated() {
  window.dispatchEvent(new Event(getOrganizationCabinetEventName()));
}

type VisibilityFilter = "all" | "archive";

type OrgEventRow = EventItem & {
  is_archived: boolean;
  is_published: boolean;
};

const emptyForm = {
  title: "",
  description: "",
  location: "",
  dateLabel: "",
  format: "offline" as "online" | "offline",
};

function mapMeEventRow(row: Record<string, unknown>): OrgEventRow {
  const id = typeof row.id === "number" ? row.id : Number(row.id) || 0;
  const format = String(row.format ?? "offline");
  return {
    id,
    title: String(row.title ?? ""),
    summary: row.summary != null ? String(row.summary) : null,
    organization_name: row.organization_name != null ? String(row.organization_name) : null,
    city: row.city != null ? String(row.city) : null,
    address: row.address != null ? String(row.address) : null,
    format,
    help_type: row.help_type != null ? String(row.help_type) : null,
    starts_at: String(row.starts_at ?? ""),
    ends_at: row.ends_at != null ? String(row.ends_at) : null,
    description: row.description != null ? String(row.description) : null,
    is_archived: Boolean(row.is_archived),
    is_published: row.is_published !== false,
  };
}

function mapPublicEventItem(item: EventItem): OrgEventRow {
  return {
    ...item,
    is_archived: false,
    is_published: true,
  };
}

function normalizeVenueText(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .replace(/^онлайн\s*,?\s*/i, "")
    .trim();
}

function locationFromEvent(item: Pick<OrgEventRow, "format" | "city" | "address">): string {
  const city = normalizeVenueText(item.city);
  const address = normalizeVenueText(item.address);
  if (item.format === "online") {
    if (address) return address;
    if (city && city.toLowerCase() !== "онлайн") return city;
    return "";
  }
  if (city && address && city !== address) return `${city}, ${address}`;
  return city || address;
}

function formatEventPlace(item: OrgEventRow): string {
  const venue = locationFromEvent(item);
  if (item.format === "online") {
    return venue ? `Онлайн, ${venue}` : "Онлайн";
  }
  return venue || "Не указано";
}

function formatEventWhen(startsAt: string): string {
  if (!startsAt.trim()) return "Не указано";
  const date = new Date(startsAt);
  if (Number.isNaN(date.getTime())) return startsAt;
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function datetimeLocalToApiValue(localValue: string): string {
  const trimmed = localValue.trim();
  if (!trimmed) return new Date().toISOString();
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return new Date().toISOString();
  const pad = (n: number) => String(n).padStart(2, "0");
  const offsetMin = -date.getTimezoneOffset();
  const sign = offsetMin >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMin);
  const oh = pad(Math.floor(abs / 60));
  const om = pad(abs % 60);
  const base = trimmed.length === 16 ? trimmed : trimmed.slice(0, 16);
  return `${base}:00${sign}${oh}:${om}`;
}

function isoToDatetimeLocalValue(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function buildEventPayload(form: typeof emptyForm) {
  const starts = datetimeLocalToApiValue(form.dateLabel);
  const venue = normalizeVenueText(form.location);
  return {
    title: form.title.trim(),
    description: form.description.trim(),
    summary: form.description.trim().slice(0, 180),
    city: form.format === "online" ? (venue ? null : "Онлайн") : venue || null,
    address: form.format === "online" ? venue || null : null,
    starts_at: starts,
    ends_at: null,
    format: form.format,
    help_type: null,
    is_published: true,
  };
}

export default function OrganizationEventsPage() {
  const { userName, role } = useUser();
  const [events, setEvents] = useState<OrgEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");
  const [search, setSearch] = useState("");
  const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter>("all");
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState(emptyForm);
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [editLoading, setEditLoading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setErrorText("");
    try {
      if (role === "organization") {
        const raw = await meOrganizationApi.listEvents();
        const rows = unwrapApiList<Record<string, unknown>>(raw);
        setEvents(rows.map(mapMeEventRow).filter((e) => e.id > 0));
        return;
      }
      const data = await eventsApi.getList();
      const items = data.items ?? [];
      const orgNeedle = (userName ?? "").trim().toLowerCase();
      const filtered = orgNeedle
        ? items.filter((e) => (e.organization_name ?? "").trim().toLowerCase() === orgNeedle)
        : items;
      setEvents(filtered.map(mapPublicEventItem));
    } catch (e) {
      setEvents([]);
      setErrorText(e instanceof Error ? e.message : "Не удалось загрузить мероприятия.");
    } finally {
      setLoading(false);
    }
  }, [role, userName]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const visibleEvents = useMemo(() => {
    const query = search.trim().toLowerCase();
    return events
      .filter((item) => (visibilityFilter === "archive" ? item.is_archived : !item.is_archived))
      .filter((item) => {
        if (!query) return true;
        const haystack = [
          item.title,
          item.description ?? "",
          item.summary ?? "",
          item.city ?? "",
          item.address ?? "",
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(query);
      });
  }, [events, search, visibilityFilter]);

  const openCreateModal = () => {
    setCreateForm(emptyForm);
    setCreateModalOpen(true);
  };

  const handleCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!createForm.title.trim() || createForm.description.trim().length < 10) return;
    void eventsApi
      .create(buildEventPayload(createForm))
      .then(() => {
        setCreateModalOpen(false);
        setCreateForm(emptyForm);
        notifyCabinetUpdated();
        return reload();
      })
      .catch((e) => setErrorText(e instanceof Error ? e.message : "Не удалось создать мероприятие."));
  };

  const openEditModal = (eventItem: OrgEventRow) => {
    setEditId(eventItem.id);
    setEditLoading(true);
    void eventsApi
      .getById(eventItem.id)
      .then((d) => {
        setEditForm({
          title: d.title,
          description: d.description ?? "",
          location: locationFromEvent({
            format: d.format,
            city: d.city,
            address: d.address,
          } as OrgEventRow),
          dateLabel: d.starts_at ? isoToDatetimeLocalValue(d.starts_at) : "",
          format: d.format === "online" ? "online" : "offline",
        });
      })
      .catch(() => setErrorText("Не удалось загрузить мероприятие."))
      .finally(() => setEditLoading(false));
  };

  const handleEdit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (editId === null || editForm.description.trim().length < 10) return;
    void eventsApi
      .patch(editId, buildEventPayload(editForm))
      .then(() => {
        notifyCabinetUpdated();
        return reload();
      })
      .then(() => setEditId(null))
      .catch(() => setErrorText("Не удалось сохранить мероприятие."));
  };

  const handleArchive = (id: number) => {
    setBusyId(id);
    void eventsApi
      .archive(id)
      .then(() => {
        notifyCabinetUpdated();
        return reload();
      })
      .catch(() => setErrorText("Не удалось отправить мероприятие в архив."))
      .finally(() => setBusyId(null));
  };

  const handleDelete = (id: number) => {
    const ok = window.confirm("Удалить мероприятие безвозвратно?");
    if (!ok) return;
    setBusyId(id);
    void eventsApi
      .delete(id)
      .then(() => {
        notifyCabinetUpdated();
        return reload();
      })
      .catch(() => setErrorText("Не удалось удалить мероприятие."))
      .finally(() => setBusyId(null));
  };

  const renderEventForm = (
    form: typeof emptyForm,
    setForm: (next: typeof emptyForm) => void,
    onSubmit: (e: FormEvent<HTMLFormElement>) => void,
    submitLabel: string,
    onCancel: () => void
  ) => (
    <form className={styles.form} onSubmit={onSubmit}>
      <div className={styles.formGrid}>
        <label className={styles.label}>
          Название
          <input
            className={styles.input}
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
          />
        </label>
        <label className={styles.label}>
          Формат
          <select
            className={styles.select}
            value={form.format}
            onChange={(e) => setForm({ ...form, format: e.target.value as "online" | "offline" })}
          >
            <option value="offline">Офлайн</option>
            <option value="online">Онлайн</option>
          </select>
        </label>
        <label className={styles.label}>
          Место
          <input
            className={styles.input}
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            placeholder={form.format === "online" ? "Видеоконференция" : "Адрес"}
          />
        </label>
        <label className={styles.label}>
          Дата и время
          <input
            type="datetime-local"
            className={styles.input}
            value={form.dateLabel}
            onChange={(e) => setForm({ ...form, dateLabel: e.target.value })}
          />
        </label>
        <label className={styles.labelFull}>
          Описание
          <textarea
            className={styles.textarea}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            minLength={10}
            required
          />
        </label>
      </div>
      <div className={styles.modalActions}>
        <button type="button" className={styles.secondaryButton} onClick={onCancel}>
          Отмена
        </button>
        <button type="submit" className={styles.primaryButton}>
          {submitLabel}
        </button>
      </div>
    </form>
  );

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <div className={styles.pageTop}>
          <div className={styles.topRow}>
            <div className={styles.titleBlock}>
              <h1 className={styles.title}>Мероприятия</h1>
              <p className={styles.subtitle}>
                Планируйте и публикуйте мероприятия организации для волонтёров и пользователей.
              </p>
            </div>
            <button type="button" className={styles.addBtn} onClick={openCreateModal}>
              + Добавить мероприятие
            </button>
          </div>

          <div className={styles.toolbar}>
            <input
              className={styles.searchInput}
              placeholder="Найти"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              className={styles.filterSelect}
              value={visibilityFilter}
              onChange={(e) => setVisibilityFilter(e.target.value as VisibilityFilter)}
              aria-label="Фильтр мероприятий"
            >
              <option value="all">Все</option>
              <option value="archive">Архив</option>
            </select>
          </div>
        </div>

        {errorText ? <p className={styles.error}>{errorText}</p> : null}
        {loading ? <p className={styles.empty}>Загрузка…</p> : null}

        {!loading && visibleEvents.length === 0 ? (
          <p className={styles.empty}>
            {visibilityFilter === "archive"
              ? "В архиве пока нет мероприятий."
              : "Мероприятия пока не добавлены."}
          </p>
        ) : null}

        {!loading && visibleEvents.length > 0 ? (
          <section className={styles.list}>
            {visibleEvents.map((eventItem) => (
              <article key={eventItem.id} className={styles.eventCard}>
                <h2 className={styles.eventTitle}>{eventItem.title}</h2>
                <p className={styles.metaLine}>Место: {formatEventPlace(eventItem)}</p>
                <p className={styles.metaLine}>Когда: {formatEventWhen(eventItem.starts_at)}</p>
                <span
                  className={`${styles.badge} ${eventItem.is_archived ? styles.badgeArchived : ""}`.trim()}
                >
                  {eventItem.is_archived ? "Архив" : "Опубликовано"}
                </span>
                <div className={styles.cardActions}>
                  <button
                    type="button"
                    className={styles.editBtn}
                    disabled={busyId === eventItem.id}
                    onClick={() => openEditModal(eventItem)}
                  >
                    Изменить
                  </button>
                  {!eventItem.is_archived ? (
                    <button
                      type="button"
                      className={styles.archiveBtn}
                      disabled={busyId === eventItem.id}
                      onClick={() => handleArchive(eventItem.id)}
                    >
                      В архив
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className={styles.deleteBtn}
                    disabled={busyId === eventItem.id}
                    onClick={() => handleDelete(eventItem.id)}
                  >
                    Удалить
                  </button>
                </div>
              </article>
            ))}
          </section>
        ) : null}
      </div>

      {isCreateModalOpen ? (
        <div className={styles.modalOverlay} role="presentation" onClick={() => setCreateModalOpen(false)}>
          <div className={styles.modal} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>Добавить мероприятие</h2>
            {renderEventForm(
              createForm,
              setCreateForm,
              handleCreate,
              "Опубликовать",
              () => setCreateModalOpen(false)
            )}
          </div>
        </div>
      ) : null}

      {editId !== null ? (
        <div className={styles.modalOverlay} role="presentation" onClick={() => setEditId(null)}>
          <div className={styles.modal} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>Редактировать мероприятие</h2>
            {editLoading ? (
              <p className={styles.empty}>Загрузка…</p>
            ) : (
              renderEventForm(editForm, setEditForm, handleEdit, "Сохранить", () => setEditId(null))
            )}
          </div>
        </div>
      ) : null}
    </main>
  );
}
