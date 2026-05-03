"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "./page.module.css";
import { urgentApi, UrgentItem } from "@/shared/api/endpoints/urgent";
import { getImageUrl } from "@/shared/api/client";

export default function AnimalPage() {
  const params = useParams();
  const id = Number(params.id);

  const [data, setData] = useState<UrgentItem | null>(null);
  const [mainImage, setMainImage] = useState("/cat-placeholder.jpg");
  const [loading, setLoading] = useState(true);
    const HELP_TYPE_LABELS: Record<string, string> = {
    financial: "Финансовая помощь",
    foster: "Передержка",
    manual: "Помощь руками",
    auto: "Автопомощь",
    medical: "Лекарства и кровь",
    };

  useEffect(() => {
    urgentApi.getById(id)
      .then((res) => {
        setData(res);

        if (res.primary_photo_url) {
          setMainImage(getImageUrl(res.primary_photo_url));
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    e.currentTarget.src = "/cat-placeholder.jpg";
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

  if (!data) {
    return (
      <div className={styles.container}>
        <div className={styles.notFound}>
          <h1>Карточка не найдена</h1>
          <Link href="/urgent">Вернуться назад</Link>
        </div>
      </div>
    );
  }

  const progress =
    data.target_amount && data.collected_amount != null
      ? Math.round((data.collected_amount / data.target_amount) * 100)
      : null;

  return (
    <main className={styles.page}>
      <div className={styles.container}>

        <div className={styles.breadcrumbs}>
          <Link href="/urgent">Срочная помощь</Link>
          <span>/</span>
          <span>{data.title}</span>
        </div>

        <div className={styles.topBlock}>

          <div className={styles.photoBlock}>
            <div className={styles.mainPhoto}>
              <img
                src={mainImage}
                alt={data.title}
                onError={handleImageError}
              />
            </div>
          </div>

          <div className={styles.infoBlock}>
            <h1>{data.title}</h1>

            <div className={styles.tags}>
              {data.is_urgent && (
                <span className={styles.urgentTag}>Срочно</span>
              )}

              {data.animal_species && <span>{data.animal_species}</span>}
              <span>{HELP_TYPE_LABELS[data.help_type] || data.help_type}</span>
              <span>{data.city}</span>
            </div>

            <p className={styles.description}>
              {data.description}
            </p>

            <div className={styles.orgBlock}>
              <img src="/org.svg" className={styles.orgIcon} alt="" />
              <span>{data.organization_name}</span>
            </div>

            {progress !== null && (
              <div className={styles.progressBlock}>
                <div className={styles.progressBar}>
                  <div style={{ width: `${progress}%` }} />
                </div>
                <span>
                  {data.collected_amount} / {data.target_amount}
                </span>
              </div>
            )}

            <div className={styles.actionButtons}>
              <button className={styles.helpBtn}>Помочь</button>

              {data.animal_id && (
                <Link
                  href={`/urgent/${data.animal_id}`}
                  className={styles.adoptBtn}
                >
                  Перейти к животному
                </Link>
              )}
            </div>
          </div>
        </div>

        <div className={styles.section}>
          <h2>Место</h2>
          <p className={styles.healthText}>
            {data.city}
          </p>
        </div>

        <div className={styles.section}>
          <h2>Срок</h2>
          <p className={styles.healthText}>
            {data.deadline_label}
          </p>
        </div>

        <div className={styles.section}>
          <h2>Метки</h2>

          <div className={styles.characterTags}>
            {data.badges?.length ? (
              data.badges.map((b, i) => (
                <span key={i} className={styles.characterTag}>
                  {b}
                </span>
              ))
            ) : (
              <span>Нет</span>
            )}
          </div>
        </div>

      </div>
    </main>
  );
}
