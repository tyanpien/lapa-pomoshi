"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import styles from "./page.module.css";
import { eventsApi, EventItem } from "@/shared/api/endpoints/events";

type EventDetail = EventItem & { description?: string };

export default function EventPage() {
  const params = useParams();
  const id = Number(params.id);

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    eventsApi.getById(id)
      .then(setEvent)
      .finally(() => setLoading(false));
  }, [id]);

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

  const formatTime = (start: string, end: string) =>
    new Date(start).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }) +
    " - " +
    new Date(end).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });

  if (loading) return <div className={styles.loading}>Загрузка...</div>;
  if (!event) return <div className={styles.notFound}>Не найдено</div>;

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <h1>{event.title}</h1>

        <div className={styles.meta}>
          <p>{formatDate(event.starts_at)}</p>
          <p>{formatTime(event.starts_at, event.ends_at)}</p>
        </div>

        <p className={styles.org}>{event.organization_name}</p>

        <p className={styles.location}>
          {event.city}, {event.address}
        </p>

        <div className={styles.description}>
          {event.description}
        </div>

        <button className={styles.btn}>Участвовать</button>
      </div>
    </main>
  );
}
