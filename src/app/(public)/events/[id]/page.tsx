"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import styles from "./page.module.css";
import { eventsApi, EventItem } from "@/shared/api/endpoints/events";
import { getLoginHref } from "@/shared/lib/auth/loginHref";
import {
  formatEventSeatsHint,
  getEventActionLabel,
  isEventActionDisabled,
} from "@/shared/lib/eventRegistration";
import { useUser } from "@/shared/lib/hooks/useUser";

export default function EventPage() {
  const params = useParams();
  const pathname = usePathname();
  const id = Number(params.id);
  const { isAuth } = useUser();

  const [event, setEvent] = useState<EventItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);

  useEffect(() => {
    eventsApi.getById(id)
      .then(setEvent)
      .finally(() => setLoading(false));
  }, [id, isAuth]);

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

  const formatTime = (start: string, end: string | null) => {
    const a = new Date(start).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
    if (!end) return a;
    return `${a} — ${new Date(end).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}`;
  };

  const applyRegistrationResult = (result: {
    seats_taken: number;
    seats_available: number | null;
    is_full: boolean;
    is_registered: boolean;
    registration_action: EventItem["registration_action"];
  }) => {
    setEvent((current) =>
      current
        ? {
            ...current,
            seats_taken: result.seats_taken,
            seats_available: result.seats_available,
            is_full: result.is_full,
            is_registered: result.is_registered,
            registration_action: result.registration_action,
          }
        : current,
    );
  };

  const handleRegister = async () => {
    if (!event || event.registration_action !== "signup") return;

    setRegistering(true);
    setRegisterError(null);

    try {
      const result = await eventsApi.register(event.id);
      applyRegistrationResult(result);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Не удалось записаться на мероприятие";
      if (message.includes("уже записаны")) {
        setEvent((current) =>
          current
            ? {
                ...current,
                is_registered: true,
                registration_action: "registered",
              }
            : current,
        );
        setRegisterError(null);
      } else {
        setRegisterError(message);
      }
    } finally {
      setRegistering(false);
    }
  };

  if (loading) return <div className={styles.loading}>Загрузка...</div>;
  if (!event) return <div className={styles.notFound}>Не найдено</div>;

  const seatsHint = formatEventSeatsHint(event.seats_available, event.capacity);
  const action = event.registration_action ?? "details";
  const actionDisabled = isEventActionDisabled(action) || registering;
  const loginHref = getLoginHref(pathname || `/events/${id}`);

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
          {[event.city, event.address].filter(Boolean).join(", ") || "Место уточняется"}
        </p>

        {seatsHint ? <p className={styles.seatsHint}>{seatsHint}</p> : null}

        <div className={styles.description}>
          {event.description}
        </div>

        {action === "details" ? (
          <p className={styles.freeEntryNote}>Свободный вход, запись не требуется</p>
        ) : action === "registered" ? (
          <p className={styles.registeredNote}>Вы уже записаны на это мероприятие</p>
        ) : !isAuth ? (
          <Link href={loginHref} className={styles.btn}>
            Войти, чтобы записаться
          </Link>
        ) : (
          <>
            <button
              type="button"
              className={`${styles.btn} ${actionDisabled ? styles.btnDisabled : ""}`.trim()}
              disabled={actionDisabled}
              onClick={handleRegister}
            >
              {registering ? "Запись..." : getEventActionLabel(action)}
            </button>
            {registerError ? <p className={styles.error}>{registerError}</p> : null}
          </>
        )}
      </div>
    </main>
  );
}
