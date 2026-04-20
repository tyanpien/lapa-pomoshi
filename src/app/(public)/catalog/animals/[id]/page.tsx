"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "./page.module.css";
import { animalsApi, Animal } from "@/shared/api/endpoints/animals";
import { getImageUrl } from "@/shared/api/client";

export default function AnimalPage() {
  const params = useParams();
  const id = Number(params.id);

  const [animal, setAnimal] = useState<Animal | null>(null);
  const [mainImage, setMainImage] = useState("/cat-placeholder.jpg");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    animalsApi.getById(id)
      .then((data) => {
        setAnimal(data);

        if (data.photo_urls?.length) {
          setMainImage(getImageUrl(data.photo_urls[0]));
        } else if (data.primary_photo_url) {
          setMainImage(getImageUrl(data.primary_photo_url));
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [id]);

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    e.currentTarget.src = "/cat-placeholder.jpg";
  };

  const getAge = (months: number) => {
    if (!months && months !== 0) return "Возраст не указан";
    if (months < 12) return `${months} ${months === 1 ? "месяц" : months < 5 ? "месяца" : "месяцев"}`;
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    if (remainingMonths === 0) {
      return `${years} ${years === 1 ? "год" : years < 5 ? "года" : "лет"}`;
    }
    return `${years} ${years === 1 ? "год" : years < 5 ? "года" : "лет"} ${remainingMonths} ${remainingMonths === 1 ? "месяц" : remainingMonths < 5 ? "месяца" : "месяцев"}`;
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

  if (!animal) {
    return (
      <div className={styles.container}>
        <div className={styles.notFound}>
          <h1>Животное не найдено</h1>
          <Link href="/catalog/animals">Вернуться к списку</Link>
        </div>
      </div>
    );
  }

  const images = animal.photo_urls?.length > 0
    ? animal.photo_urls.map(url => getImageUrl(url))
    : animal.primary_photo_url
      ? [getImageUrl(animal.primary_photo_url)]
      : ["/cat-placeholder.jpg"];

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <div className={styles.breadcrumbs}>
          <Link href="/catalog/animals">Животные</Link>
          <span>/</span>
          <span>{animal.name}</span>
        </div>

        <div className={styles.topBlock}>
          <div className={styles.photoBlock}>
            <div className={styles.mainPhoto}>
              <img
                src={mainImage}
                alt={animal.name}
                onError={handleImageError}
              />
            </div>

            {images.length > 1 && (
              <div className={styles.thumbnails}>
                {images.map((img: string, idx: number) => (
                  <div
                    key={idx}
                    className={`${styles.thumbnail} ${
                      mainImage === img ? styles.activeThumb : ""
                    }`}
                    onClick={() => setMainImage(img)}
                  >
                    <img
                      src={img}
                      alt={`${animal.name} ${idx + 1}`}
                      onError={handleImageError}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={styles.infoBlock}>
            <h1>{animal.name}</h1>

            <div className={styles.tags}>
              {animal.is_urgent && <span className={styles.urgentTag}>Срочно</span>}
              <span>{animal.species}</span>
              <span>{animal.breed || "Метис"}</span>
              <span>{getAge(animal.age_months)}</span>
            </div>

            <p className={styles.description}>
              {animal.full_description || "Описание отсутствует"}
            </p>

            <div className={styles.orgBlock}>
              <img src="/org.svg" className={styles.orgIcon} alt="Организация" />
              <span>
                {animal.organization?.name || "Организация не указана"}
              </span>
            </div>

            <div className={styles.actionButtons}>
              <button className={styles.helpBtn}>Помочь</button>
              <button className={styles.adoptBtn}>
                {animal.status === "looking_for_home"
                  ? "Забрать домой"
                  : "Забрать на передержку"}
              </button>
            </div>
          </div>
        </div>

        <div className={styles.section}>
          <h2>Здоровье и уход</h2>

          <div className={styles.healthGrid}>
            <div className={styles.healthItem}>
              <img src="/check.svg" alt="" />
              <span>Стерилизован(а)</span>
            </div>
            <div className={styles.healthItem}>
              <img src="/check.svg" alt="" />
              <span>Привит(а)</span>
            </div>
            <div className={styles.healthItem}>
              <img src="/check.svg" alt="" />
              <span>Обработан(а) от паразитов</span>
            </div>
            <div className={styles.healthItem}>
              <img src="/check.svg" alt="" />
              <span>Приучен к лотку / выгулу</span>
            </div>
          </div>
        </div>

        <div className={styles.twoColumns}>
          <div className={styles.column}>
            <h2>Особенности здоровья:</h2>
            <p className={styles.healthText}>
              {animal.health_features || "Не указано"}
            </p>
          </div>

          <div className={styles.column}>
            <h2>Требуемое лечение:</h2>
            <p className={styles.healthText}>
              {animal.treatment_required || "Не требуется"}
            </p>
          </div>
        </div>

        <div className={styles.section}>
          <h2>Особенности характера</h2>

          <div className={styles.characterTags}>
            {animal.character_tags?.length ? (
              animal.character_tags.map((trait: string, idx: number) => (
                <span key={idx} className={styles.characterTag}>
                  {trait}
                </span>
              ))
            ) : (
              <span>Не указано</span>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
