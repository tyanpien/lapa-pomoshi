"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "./page.module.css";
import { volunteersApi, VolunteerDetail } from "@/shared/api/endpoints/volunteers";
import { getImageUrl } from "@/shared/api/client";

export default function VolunteerPage() {
  const params = useParams();
  const id = Number(params.id);

  const [volunteer, setVolunteer] = useState<VolunteerDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    volunteersApi.getById(id)
      .then((data) => {
        setVolunteer(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [id]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.notFound}>
          <h1>Загрузка...</h1>
        </div>
      </div>
    );
  }

  if (!volunteer) {
    return (
      <div className={styles.container}>
        <div className={styles.notFound}>
          <h1>Волонтер не найден</h1>
          <Link href="/catalog/volunteers">Вернуться к списку</Link>
        </div>
      </div>
    );
  }

  const fullNameParts = volunteer.full_name?.split(" ") || ["Волонтер", ""];
  const firstName = fullNameParts[0] || "Волонтер";
  const lastName = fullNameParts[1] || "";
  const isAvailable = Boolean(volunteer.is_available);
  const experienceLabel = volunteer.experience_level_label || (volunteer.completed_tasks_count >= 10 ? "Опытный" : "Новичок");
  const availabilitySchedule = volunteer.availability?.trim() || "График не указан";
  const availabilityCaption = isAvailable ? "Готова выезжать за помощь" : "Временно не беру задачи";

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <nav className={styles.breadcrumbs} aria-label="Хлебные крошки">
          <Link href="/catalog/volunteers">Волонтеры</Link>
          <span>/</span>
          <span>{volunteer.full_name}</span>
        </nav>

        <header className={styles.profileHeader}>
          <div className={styles.headerMain}>
            <div className={styles.avatarWrap}>
              <div className={styles.avatar}>
                <img src={getImageUrl(volunteer.avatar_url) || "/event.png"} alt={volunteer.full_name} />
              </div>
              <span
                className={`${styles.statusDot} ${isAvailable ? styles.statusDotAvailable : styles.statusDotBusy}`}
                aria-label={isAvailable ? "Доступна" : "Занята"}
              />
            </div>

            <div className={styles.profileInfo}>
              <h1 className={styles.title}>
                {firstName} {lastName}
              </h1>
              <p className={styles.location}>
                <img src="/city.svg" alt="" aria-hidden="true" className={styles.locationIcon} />
                {volunteer.location_city || "Город не указан"}
              </p>
              <div className={styles.tagsRow}>
                <span className={styles.stateTag}>{isAvailable ? "Готова к задачам" : "Занята"}</span>
                <span className={styles.experienceTag}>{experienceLabel}</span>
              </div>
              <div className={styles.actionsRow}>
                <Link href={`/messages/${volunteer.user_id}`} className={styles.writeBtn}>
                  Написать
                </Link>
                <button type="button" className={styles.offerBtn}>
                  Предложить задачу
                </button>
              </div>
            </div>
          </div>

          <aside className={styles.tasksBlock} aria-label="Статистика выполненных задач">
            <p className={styles.tasksNumber}>{volunteer.completed_tasks_count}</p>
            <p className={styles.tasksLabel}>выполненных задач</p>
          </aside>
        </header>

        <section className={styles.contentGrid} aria-label="Информация о волонтере">
          <div className={styles.mainColumn}>
            <section className={styles.infoSection} aria-labelledby="about-title">
              <h2 id="about-title" className={styles.sectionTitle}>О себе</h2>
              <p className={styles.aboutText}>{volunteer.about_me || "Информация о себе не указана"}</p>
            </section>

            <section className={styles.infoSection} aria-labelledby="skills-title">
              <h2 id="skills-title" className={styles.sectionTitle}>Компетенции</h2>
              <div className={styles.skillsList}>
                {volunteer.competency_labels?.map((skill, idx) => (
                  <span key={idx} className={styles.skillTag}>{skill}</span>
                ))}
              </div>
              <aside className={styles.availabilityCard} aria-labelledby="availability-title">
                <h2 id="availability-title" className={styles.availabilityTitle}>Доступность</h2>
                <div className={styles.availabilityList}>
                  <span className={styles.availabilityChip}>{availabilitySchedule}</span>
                </div>
                <p className={styles.availabilityCaption}>{availabilityCaption}</p>
              </aside>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
