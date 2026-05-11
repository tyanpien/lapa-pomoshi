"use client";

import { useParams, usePathname } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "./page.module.css";
import { animalsApi, Animal } from "@/shared/api/endpoints/animals";
import { getImageUrl } from "@/shared/api/client";
import { getOrganizationAnimalById } from "@/shared/lib/organizationAnimals";
import { useUser } from "@/shared/lib/hooks/useUser";
import { meApplicationsApi } from "@/shared/api/endpoints/meApplications";
import { getLoginHref } from "@/shared/lib/auth/loginHref";

export default function AnimalPage() {
  const params = useParams();
  const pathname = usePathname();
  const id = Number(params.id);

  const { isAuth, role } = useUser();
  const canApplyAdoption = isAuth && (role === "user" || role === "volunteer");

  const [animal, setAnimal] = useState<Animal | null>(null);
  const [mainImage, setMainImage] = useState("/cat-placeholder.jpg");
  const [loading, setLoading] = useState(true);
  const [adoptOpen, setAdoptOpen] = useState(false);
  const [adoptMessage, setAdoptMessage] = useState("");
  const [adoptError, setAdoptError] = useState("");
  const [adoptSending, setAdoptSending] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const applyAnimal = (data: Animal) => {
      setAnimal(data);
      if (data.photo_urls?.length) {
        setMainImage(getImageUrl(data.photo_urls[0]));
      } else if (data.primary_photo_url) {
        setMainImage(getImageUrl(data.primary_photo_url));
      } else {
        setMainImage("/cat-placeholder.jpg");
      }
    };

    setLoading(true);
    animalsApi
      .getById(id)
      .then((data) => {
        if (cancelled) return;
        applyAnimal(data as Animal);
        setLoading(false);
      })
      .catch(() => {
        const localAnimal = getOrganizationAnimalById(id);
        if (cancelled) return;
        if (localAnimal) {
          applyAnimal(localAnimal);
        } else {
          setAnimal(null);
        }
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
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

  const photoUrls = animal.photo_urls ?? [];
  const images = photoUrls.length > 0
    ? photoUrls.map((url) => getImageUrl(url))
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
              <Link
                href={isAuth ? "/help" : getLoginHref("/help")}
                className={styles.helpBtn}
              >
                Помочь
              </Link>
              {canApplyAdoption ? (
                <button type="button" className={styles.adoptBtn} onClick={() => setAdoptOpen(true)}>
                  {animal.status === "looking_for_home" ? "Забрать домой" : "Забрать на передержку"}
                </button>
              ) : (
                <Link href={getLoginHref(pathname || `/catalog/animals/${id}`)} className={styles.adoptBtn}>
                  Войти, чтобы подать анкету
                </Link>
              )}
            </div>
          </div>
        </div>

        <div className={styles.section}>
          <h2>Здоровье и уход</h2>

          <div className={styles.healthGrid}>
            {animal.health_checklist?.length ? (
              animal.health_checklist.map((item, idx) => (
                <div key={`${item}-${idx}`} className={styles.healthItem}>
                  <img src="/check.svg" alt="" />
                  <span>{item}</span>
                </div>
              ))
            ) : (
              <span>Не указано</span>
            )}
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

      {adoptOpen && animal ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
          }}
          role="presentation"
          onClick={() => !adoptSending && setAdoptOpen(false)}
        >
          <div
            style={{ background: "#fff", padding: 24, maxWidth: 480, width: "90%" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2>Заявка на животное</h2>
            <p>Сообщение для организации (необязательно):</p>
            <textarea
              rows={6}
              style={{ width: "100%", marginTop: 8 }}
              value={adoptMessage}
              onChange={(e) => setAdoptMessage(e.target.value)}
              disabled={adoptSending}
            />
            {adoptError ? <p style={{ color: "#a33" }}>{adoptError}</p> : null}
            <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
              <button type="button" disabled={adoptSending} onClick={() => setAdoptOpen(false)}>
                Отмена
              </button>
              <button
                type="button"
                disabled={adoptSending}
                onClick={() => {
                  setAdoptSending(true);
                  setAdoptError("");
                  void meApplicationsApi
                    .create({ animal_id: animal.id, message: adoptMessage.trim() || null })
                    .then(() => {
                      setAdoptOpen(false);
                      setAdoptMessage("");
                      window.location.href = "/profile/applications";
                    })
                    .catch((e) =>
                      setAdoptError(e instanceof Error ? e.message : "Не удалось отправить заявку.")
                    )
                    .finally(() => setAdoptSending(false));
                }}
              >
                {adoptSending ? "Отправка…" : "Отправить"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
