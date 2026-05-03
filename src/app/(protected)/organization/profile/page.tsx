"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import volunteerStyles from "../../volunteer/profile/page.module.css";
import animalsStyles from "../animals/page.module.css";
import styles from "./page.module.css";
import {
  getOrganizationCabinetEventName,
  getOrganizationProfile,
  saveOrganizationProfile,
} from "@/shared/lib/organizationCabinet";
import { getCurrentOrganizationAnimals, getOrganizationAnimalsEventName } from "@/shared/lib/organizationAnimals";
import { mergeApiAndLocalAnimals } from "@/shared/lib/organizationPublicWards";
import { getThreadsByRole } from "@/shared/lib/messages";
import { useUser } from "@/shared/lib/hooks/useUser";
import { useOrganizationPublicCabinetPayload } from "@/shared/lib/hooks/useOrganizationPublicCabinetPayload";

export default function OrganizationProfilePage() {
  const { role } = useUser();
  const apiPayload = useOrganizationPublicCabinetPayload();
  const [profile, setProfile] = useState(getOrganizationProfile());
  const [localAnimals, setLocalAnimals] = useState(getCurrentOrganizationAnimals());
  const [isEditModalOpen, setEditModalOpen] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const cabinetEvent = getOrganizationCabinetEventName();
    const animalsEvent = getOrganizationAnimalsEventName();
    const sync = () => {
      setProfile(getOrganizationProfile());
      setLocalAnimals(getCurrentOrganizationAnimals());
    };
    sync();
    window.addEventListener(cabinetEvent, sync);
    window.addEventListener(animalsEvent, sync);
    return () => {
      window.removeEventListener(cabinetEvent, sync);
      window.removeEventListener(animalsEvent, sync);
    };
  }, []);

  const threads = useMemo(() => getThreadsByRole(role), [role]);

  const previewThreads = threads.slice(0, 3);

  const displayAnimals = useMemo(
    () => mergeApiAndLocalAnimals(apiPayload.apiAnimals, localAnimals),
    [apiPayload.apiAnimals, localAnimals]
  );

  const statusLabel = (status: string) => {
    if (status === "looking_for_home") return "ищет дом";
    if (status === "on_treatment") return "на лечении";
    if (status === "looking_for_foster") return "ищет передержку";
    return "в приюте";
  };

  const formatAge = (months: number) => {
    if (months < 12) return `${months || 1} мес`;
    const years = Math.floor(months / 12);
    return `${years} ${years === 1 ? "год" : years < 5 ? "года" : "лет"}`;
  };

  const organizationTitle = profile.organizationName?.trim() || "Название организации";

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    saveOrganizationProfile(profile);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    setEditModalOpen(false);
  };

  return (
    <main className={volunteerStyles.page}>
      <div className={volunteerStyles.container}>
        <header className={volunteerStyles.userHeader}>
          <div className={volunteerStyles.userHeaderIdentity}>
            <div className={volunteerStyles.avatarPlaceholder} />
            <h1>{organizationTitle}</h1>
          </div>
          <button type="button" className={volunteerStyles.headerProfileAction} onClick={() => setEditModalOpen(true)}>
            Редактировать профиль
          </button>
        </header>

        <section className={volunteerStyles.section}>
          <div className={volunteerStyles.sectionTop}>
            <h2>Мои сообщения</h2>
            <Link href="/messages" className={volunteerStyles.viewAll}>
              Смотреть все
            </Link>
          </div>

          {previewThreads.length === 0 ? (
            <p className={styles.emptyState}>Пока нет сообщений.</p>
          ) : (
            <div className={volunteerStyles.messageList}>
              {previewThreads.map((thread) => (
                <article key={thread.id} className={volunteerStyles.messageItem}>
                  <div className={volunteerStyles.smallAvatar} />
                  <div className={volunteerStyles.messageMeta}>
                    <p>{thread.title}</p>
                  </div>
                  {thread.unread ? <span className={volunteerStyles.unread}>{thread.unread}</span> : null}
                </article>
              ))}
            </div>
          )}
        </section>

        <section className={volunteerStyles.section}>
          <div className={volunteerStyles.sectionTop}>
            <h2>Подопечные</h2>
            <Link href="/organization/animals" className={volunteerStyles.viewAll}>
              Смотреть все
            </Link>
          </div>

          {displayAnimals.length === 0 ? (
            <p className={styles.emptyState}>Добавьте подопечных в разделе «Подопечные».</p>
          ) : (
            <div className={animalsStyles.list}>
              {displayAnimals.slice(0, 3).map((animal) => (
                <article key={animal.id} className={animalsStyles.animalCard}>
                  <div className={animalsStyles.cover}>
                    <img src={animal.primary_photo_url || "/cat.png"} alt={animal.name} />
                    {animal.is_urgent ? <span className={animalsStyles.urgentBadge}>срочно</span> : null}
                    <span className={animalsStyles.statusBadge}>{statusLabel(animal.status)}</span>
                  </div>
                  <div className={animalsStyles.animalBody}>
                    <h3 className={animalsStyles.animalName}>{animal.name}</h3>
                    <div className={animalsStyles.tags}>
                      <span>{animal.species || "Не указан"}</span>
                      <span>{animal.breed || "Метис"}</span>
                      <span>{formatAge(animal.age_months || 0)}</span>
                    </div>
                    <p className={animalsStyles.organizationLine}>{organizationTitle}</p>
                    <Link className={animalsStyles.moreButton} href={`/catalog/animals/${animal.id}`}>
                      Подробнее
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      {isEditModalOpen ? (
        <div className={styles.modalOverlay} onClick={() => setEditModalOpen(false)}>
          <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
            <h2 className={styles.modalTitle}>Редактирование профиля</h2>
            <form className={styles.form} onSubmit={handleSubmit}>
              <label className={styles.label}>
                Название организации
                <input
                  className={styles.input}
                  value={profile.organizationName}
                  onChange={(event) => setProfile((prev) => ({ ...prev, organizationName: event.target.value }))}
                />
              </label>
              <label className={styles.label}>
                Описание
                <textarea
                  className={styles.textarea}
                  value={profile.description || ""}
                  onChange={(event) => setProfile((prev) => ({ ...prev, description: event.target.value }))}
                />
              </label>
              <label className={styles.label}>
                Специализация
                <input
                  className={styles.input}
                  value={profile.specialization}
                  onChange={(event) => setProfile((prev) => ({ ...prev, specialization: event.target.value }))}
                />
              </label>
              <label className={styles.label}>
                Территория работы
                <input
                  className={styles.input}
                  value={profile.territory}
                  onChange={(event) => setProfile((prev) => ({ ...prev, territory: event.target.value }))}
                />
              </label>
              <label className={styles.label}>
                Контакты
                <textarea
                  className={styles.textarea}
                  value={profile.contacts}
                  onChange={(event) => setProfile((prev) => ({ ...prev, contacts: event.target.value }))}
                />
              </label>
              <label className={styles.label}>
                Ссылка VK
                <input
                  className={styles.input}
                  value={profile.vkUrl || ""}
                  onChange={(event) => setProfile((prev) => ({ ...prev, vkUrl: event.target.value }))}
                  placeholder="https://vk.com/..."
                />
              </label>
              <label className={styles.label}>
                Ссылка Telegram
                <input
                  className={styles.input}
                  value={profile.telegramUrl || ""}
                  onChange={(event) => setProfile((prev) => ({ ...prev, telegramUrl: event.target.value }))}
                  placeholder="https://t.me/..."
                />
              </label>
              <label className={styles.label}>
                Ссылка WhatsApp
                <input
                  className={styles.input}
                  value={profile.whatsappUrl || ""}
                  onChange={(event) => setProfile((prev) => ({ ...prev, whatsappUrl: event.target.value }))}
                  placeholder="https://wa.me/..."
                />
              </label>
              <label className={styles.label}>
                Правила приема животных
                <textarea
                  className={styles.textarea}
                  value={profile.admissionRules}
                  onChange={(event) => setProfile((prev) => ({ ...prev, admissionRules: event.target.value }))}
                />
              </label>
              <label className={styles.label}>
                Текущие потребности
                <textarea
                  className={styles.textarea}
                  value={profile.currentNeeds}
                  onChange={(event) => setProfile((prev) => ({ ...prev, currentNeeds: event.target.value }))}
                />
              </label>
              <label className={styles.label}>
                Способы помощи
                <textarea
                  className={styles.textarea}
                  value={profile.helpWays}
                  onChange={(event) => setProfile((prev) => ({ ...prev, helpWays: event.target.value }))}
                />
              </label>
              <label className={styles.label}>
                Сценарий пристроя
                <textarea
                  className={styles.textarea}
                  value={profile.adoptionScenario || ""}
                  onChange={(event) => setProfile((prev) => ({ ...prev, adoptionScenario: event.target.value }))}
                />
              </label>
              <div className={styles.actions}>
                <button type="submit" className={styles.primaryButton}>
                  Сохранить
                </button>
                <button type="button" className={styles.secondaryButton} onClick={() => setEditModalOpen(false)}>
                  Отмена
                </button>
                {saved ? <span className={styles.savedLabel}>Сохранено</span> : null}
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  );
}
