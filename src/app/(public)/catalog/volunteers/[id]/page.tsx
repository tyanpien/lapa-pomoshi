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

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <div className={styles.breadcrumbs}>
          <Link href="/catalog/volunteers">Волонтеры</Link>
          <span>/</span>
          <span>{volunteer.full_name}</span>
        </div>

        <div className={styles.profileHeader}>
          <div className={styles.avatar}>
            <img
              src={getImageUrl(volunteer.avatar_url) || "/event.png"}
              alt={volunteer.full_name}
            />
          </div>

          <div className={styles.profileInfo}>
            <div className={styles.nameRow}>
              <h1>{firstName} {lastName}</h1>
              <Link href={`/messages/${volunteer.user_id}`} className={styles.writeBtn}>
                Написать
              </Link>
            </div>

            <div className={styles.infoRow}>
              <span className={styles.infoItem}>
                <img src="/star.svg" alt="рейтинг" className={styles.infoIconR} />
                {volunteer.rating}
              </span>
              <span className={styles.infoItem}>
                <img src="/city.svg" alt="город" className={styles.infoIcon} />
                {volunteer.location_city}
              </span>
              <span className={styles.infoItem}>
                <img src="/car.svg" alt="выезд" className={styles.infoIcon} />
                Выезд до {volunteer.travel_radius_km} км
              </span>
              {volunteer.is_available && (
                <span className={styles.availableBadge}>Доступен</span>
              )}
            </div>
          </div>
        </div>

        <div className={styles.threeColumns}>
          <div className={styles.column}>
            <h2>Компетенции</h2>
            <div className={styles.skillsList}>
              {volunteer.competency_labels?.map((skill, idx) => (
                <span key={idx} className={styles.skillTag}>{skill}</span>
              ))}
            </div>
          </div>

          <div className={styles.column}>
            <h2>О себе</h2>
            <p className={styles.aboutText}>
              {volunteer.about_me || "Информация о себе не указана"}
            </p>
            <div className={styles.withWhomLink}>
              {volunteer.animal_type_labels?.map((type, idx) => (
                <Link key={idx} href="#">{type}</Link>
              ))}
            </div>
          </div>

          <div className={styles.column}>
            <h2>Доступность</h2>
            <div className={styles.availability}>
              <div className={styles.availabilityItem}>
                <span className={styles.availabilityDay}>График:</span>
                <span>{volunteer.availability || "Не указан"}</span>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.tasksBlock}>
          <div className={styles.tasksNumber}>{volunteer.completed_tasks_count}</div>
          <div className={styles.tasksLabel}>выполненных задач</div>
        </div>

        <div className={styles.reviewsSection}>
          <h2>Отзывы</h2>
          {volunteer.reviews?.length > 0 ? (
            volunteer.reviews.map((review, idx) => (
              <div key={idx} className={styles.reviewCard}>
                <div className={styles.reviewHeader}>
                  <div className={styles.reviewAuthorBlock}>
                    <div className={styles.reviewAvatar}>
                      <img
                        src={getImageUrl(review.author_avatar_url) || "/event.png"}
                        alt={review.author_name}
                      />
                    </div>
                    <div className={styles.reviewAuthorInfo}>
                      <span className={styles.reviewAuthor}>{review.author_name}</span>
                      <span className={styles.reviewDate}>{formatDate(review.review_date)}</span>
                    </div>
                  </div>
                </div>
                <div className={styles.reviewRating}>
                  {"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}
                </div>
                <p className={styles.reviewText}>{review.text}</p>
              </div>
            ))
          ) : (
            <p className={styles.noReviews}>Пока нет отзывов</p>
          )}
        </div>
      </div>
    </main>
  );
}
