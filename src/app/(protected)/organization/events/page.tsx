"use client";

import { FormEvent, useEffect, useState } from "react";
import styles from "../organization.module.css";
import { eventsApi, type EventItem } from "@/shared/api/endpoints/events";
import { useUser } from "@/shared/lib/hooks/useUser";

export default function OrganizationEventsPage() {
  const { userName } = useUser();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [dateLabel, setDateLabel] = useState("");
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editStarts, setEditStarts] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  const reload = async () => {
    setLoading(true);
    setErrorText("");
    try {
      const data = await eventsApi.getList();
      const items = data.items ?? [];
      const orgNeedle = (userName ?? "").trim().toLowerCase();
      const filtered = orgNeedle
        ? items.filter((e) => (e.organization_name ?? "").trim().toLowerCase() === orgNeedle)
        : items;
      setEvents(filtered);
    } catch (e) {
      setEvents([]);
      setErrorText(e instanceof Error ? e.message : "Не удалось загрузить мероприятия.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, [userName]);

  const handleCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim() || description.trim().length < 10) return;
    const starts = dateLabel.trim() ? new Date(dateLabel).toISOString() : new Date().toISOString();
    void eventsApi
      .create({
        title: title.trim(),
        description: description.trim(),
        summary: description.trim().slice(0, 180),
        city: location.trim() || null,
        address: location.trim() || null,
        starts_at: starts,
        ends_at: null,
        format: "offline",
        help_type: null,
      })
      .then(() => {
        setTitle("");
        setDescription("");
        setLocation("");
        setDateLabel("");
        return reload();
      })
      .catch((e) => setErrorText(e instanceof Error ? e.message : "Не удалось создать мероприятие."));
  };

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <h1 className={styles.title}>Мои мероприятия</h1>
        <p className={styles.subtitle}>
          Планируйте и публикуйте мероприятия организации для волонтеров и пользователей.
        </p>

        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Новое мероприятие</h2>
          <form onSubmit={handleCreate}>
            <div className={styles.grid}>
              <label className={styles.label}>
                Название
                <input className={styles.input} value={title} onChange={(e) => setTitle(e.target.value)} />
              </label>
              <label className={styles.label}>
                Локация
                <input className={styles.input} value={location} onChange={(e) => setLocation(e.target.value)} />
              </label>
              <label className={styles.label}>
                Дата и время начала (локально)
                <input
                  type="datetime-local"
                  className={styles.input}
                  value={dateLabel}
                  onChange={(e) => setDateLabel(e.target.value)}
                />
              </label>
            </div>
            <label className={styles.label}>
              Описание
              <textarea className={styles.textarea} value={description} onChange={(e) => setDescription(e.target.value)} minLength={10} required />
            </label>
            <div className={styles.actions}>
              <button className={styles.primaryButton} type="submit">
                Опубликовать мероприятие
              </button>
            </div>
          </form>
        </section>

        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Календарь событий</h2>
          {loading ? (
            <p className={styles.empty}>Загрузка...</p>
          ) : errorText ? (
            <p className={styles.empty}>{errorText}</p>
          ) : events.length === 0 ? (
            <p className={styles.empty}>Мероприятия пока не добавлены.</p>
          ) : (
            <div className={styles.list}>
              {events.map((eventItem) => (
                <article className={styles.animalCard} key={eventItem.id}>
                  <div className={styles.animalInfo}>
                    <h3 className={styles.animalName}>{eventItem.title}</h3>
                    <p className={styles.animalMeta}>{eventItem.description ?? eventItem.summary ?? ""}</p>
                    <p className={styles.metaLine}>
                      Место: {[eventItem.city, eventItem.address].filter(Boolean).join(", ") || "Не указано"}
                    </p>
                    <p className={styles.metaLine}>Когда: {eventItem.starts_at || "Не указано"}</p>
                    <div className={styles.badgeRow}>
                      <span className={styles.badge}>Опубликовано</span>
                    </div>
                    <div className={styles.actions}>
                      <button
                        type="button"
                        className={styles.secondaryButton}
                        onClick={() => {
                          setEditId(eventItem.id);
                          setEditLoading(true);
                          void eventsApi
                            .getById(eventItem.id)
                            .then((d) => {
                              setEditTitle(d.title);
                              setEditDescription(d.description ?? "");
                              setEditCity(d.city ?? d.address ?? "");
                              const st = d.starts_at ? new Date(d.starts_at) : new Date();
                              const pad = (n: number) => String(n).padStart(2, "0");
                              setEditStarts(
                                `${st.getFullYear()}-${pad(st.getMonth() + 1)}-${pad(st.getDate())}T${pad(st.getHours())}:${pad(st.getMinutes())}`
                              );
                            })
                            .catch(() => setErrorText("Не удалось загрузить событие."))
                            .finally(() => setEditLoading(false));
                        }}
                      >
                        Изменить
                      </button>
                      <button
                        type="button"
                        className={styles.secondaryButton}
                        onClick={() => void eventsApi.archive(eventItem.id).then(reload).catch(() => {})}
                      >
                        В архив
                      </button>
                      <button
                        type="button"
                        className={styles.dangerButton}
                        onClick={() => void eventsApi.delete(eventItem.id).then(reload).catch(() => {})}
                      >
                        Удалить
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      {editId !== null ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
          }}
          role="presentation"
          onClick={() => setEditId(null)}
        >
          <div className={styles.card} style={{ maxWidth: 520, width: "92%" }} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.cardTitle}>Редактирование события</h2>
            {editLoading ? (
              <p>Загрузка…</p>
            ) : (
              <form
                className={styles.grid}
                onSubmit={(e) => {
                  e.preventDefault();
                  if (editDescription.trim().length < 10) return;
                  const starts_iso = editStarts.trim() ? new Date(editStarts).toISOString() : new Date().toISOString();
                  void eventsApi
                    .patch(editId, {
                      title: editTitle.trim(),
                      description: editDescription.trim(),
                      summary: editDescription.trim().slice(0, 180),
                      city: editCity.trim() || null,
                      address: editCity.trim() || null,
                      starts_at: starts_iso,
                    })
                    .then(() => reload())
                    .then(() => setEditId(null))
                    .catch(() => setErrorText("Не удалось сохранить событие."));
                }}
              >
                <label className={styles.label}>
                  Название
                  <input className={styles.input} value={editTitle} onChange={(e) => setEditTitle(e.target.value)} required />
                </label>
                <label className={styles.label}>
                  Город / адрес
                  <input className={styles.input} value={editCity} onChange={(e) => setEditCity(e.target.value)} />
                </label>
                <label className={styles.label}>
                  Начало
                  <input
                    type="datetime-local"
                    className={styles.input}
                    value={editStarts}
                    onChange={(e) => setEditStarts(e.target.value)}
                  />
                </label>
                <label className={styles.label}>
                  Описание
                  <textarea
                    className={styles.textarea}
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    minLength={10}
                    required
                  />
                </label>
                <div className={styles.actions}>
                  <button type="submit" className={styles.primaryButton}>
                    Сохранить
                  </button>
                  <button type="button" className={styles.secondaryButton} onClick={() => setEditId(null)}>
                    Отмена
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </main>
  );
}
