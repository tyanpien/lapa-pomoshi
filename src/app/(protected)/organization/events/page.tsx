"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import styles from "../organization.module.css";
import {
  addOrganizationEvent,
  getOrganizationCabinetEventName,
  getOrganizationEvents,
  toggleOrganizationEventArchive,
} from "@/shared/lib/organizationCabinet";
import { mergeApiFirstById } from "@/shared/lib/organizationPublicCabinet";
import { useOrganizationPublicCabinetPayload } from "@/shared/lib/hooks/useOrganizationPublicCabinetPayload";

export default function OrganizationEventsPage() {
  const apiPayload = useOrganizationPublicCabinetPayload();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [dateLabel, setDateLabel] = useState("");
  const [localEvents, setLocalEvents] = useState(getOrganizationEvents());

  useEffect(() => {
    const eventName = getOrganizationCabinetEventName();
    const sync = () => setLocalEvents(getOrganizationEvents());
    sync();
    window.addEventListener(eventName, sync);
    return () => window.removeEventListener(eventName, sync);
  }, []);

  const events = useMemo(
    () => mergeApiFirstById(apiPayload.apiEvents, localEvents),
    [apiPayload.apiEvents, localEvents]
  );

  const handleCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim() || !description.trim()) return;
    addOrganizationEvent({
      title: title.trim(),
      description: description.trim(),
      location: location.trim(),
      dateLabel: dateLabel.trim(),
    });
    setTitle("");
    setDescription("");
    setLocation("");
    setDateLabel("");
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
                Дата и время
                <input className={styles.input} value={dateLabel} onChange={(e) => setDateLabel(e.target.value)} />
              </label>
            </div>
            <label className={styles.label}>
              Описание
              <textarea
                className={styles.textarea}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
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
          {events.length === 0 ? (
            <p className={styles.empty}>Мероприятия пока не добавлены.</p>
          ) : (
            <div className={styles.list}>
              {events.map((eventItem) => (
                <article className={styles.animalCard} key={eventItem.id}>
                  <div className={styles.animalInfo}>
                    <h3 className={styles.animalName}>{eventItem.title}</h3>
                    <p className={styles.animalMeta}>{eventItem.description}</p>
                    <p className={styles.metaLine}>Место: {eventItem.location || "Не указано"}</p>
                    <p className={styles.metaLine}>Когда: {eventItem.dateLabel || "Не указано"}</p>
                    <div className={styles.badgeRow}>
                      <span className={styles.badge}>{eventItem.archived ? "Архив" : "Опубликовано"}</span>
                    </div>
                    <div className={styles.actions}>
                      {!apiPayload.apiEventIds.has(eventItem.id) ? (
                        <button
                          className={styles.secondaryButton}
                          onClick={() => toggleOrganizationEventArchive(eventItem.id)}
                        >
                          {eventItem.archived ? "Вернуть из архива" : "В архив"}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
