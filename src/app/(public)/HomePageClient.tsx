"use client";

import { useState } from "react";
import styles from "./page.module.css";
import Link from "next/link";
import type { Animal } from "@/shared/api/endpoints/animals";
import { useRouter } from "next/navigation";
import { organizationLogoPath, type Organization } from "@/shared/api/endpoints/organizations";
import type { EventItem } from "@/shared/api/endpoints/events";
import { getImageUrl } from "@/shared/api/client";
import type { UrgentItem } from "@/shared/api/endpoints/urgent";
import { takeFirstSentences } from "@/shared/lib/teaserSentences";
import { formatRub } from "@/shared/lib/formatRub";
import { getLoginHref } from "@/shared/lib/auth/loginHref";
import { useUser } from "@/shared/lib/hooks/useUser";

export type HomePageClientProps = {
  urgentList: UrgentItem[];
  animals: Animal[];
  organizations: Organization[];
  homeEvents: EventItem[];
};

export default function HomePageClient({
  urgentList,
  animals,
  organizations,
  homeEvents,
}: HomePageClientProps) {
  const { isAuth } = useUser();
  const [activeFilter, setActiveFilter] = useState("Все");

  const getHelpLabel = (type: string) => {
    switch (type) {
      case "financial":
        return "Сбор";
      case "foster":
        return "Передержка";
      case "manual":
        return "Волонтер";
      case "auto":
        return "Авто";
      case "medical":
        return "Лекарства";
      case "food":
      case "feed":
        return "Корм";
      default:
        return type;
    }
  };

  const getCollectionProgressPercent = (item: UrgentItem): number | null => {
    if (item.target_amount == null || item.target_amount <= 0) return null;
    const raw = item.collected_amount;
    const collected =
      raw == null || !Number.isFinite(Number(raw)) ? 0 : Number(raw);
    return Math.min(100, Math.round((collected / item.target_amount) * 100));
  };

  const bigCard = urgentList[0];
  const smallCards = urgentList.slice(1, 5);

  const formatAge = (months: number): string => {
    if (!months && months !== 0) return "Возраст не указан";
    if (months < 12) {
      return `${months} ${months === 1 ? "месяц" : months < 5 ? "месяца" : "месяцев"}`;
    }
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    if (remainingMonths === 0) {
      return `${years} ${years === 1 ? "год" : years < 5 ? "года" : "лет"}`;
    }
    return `${years} ${years === 1 ? "год" : years < 5 ? "года" : "лет"}`;
  };

  const getSpeciesType = (species: string): string => {
    if (!species) return "other";
    const val = species.toLowerCase().trim();

    const catKeywords = ["кот", "кош", "котёнок", "котенок", "котяра", "котик"];
    const dogKeywords = ["соб", "пёс", "пес", "щен", "собач", "дог", "dog", "псина", "собака", "пёсик", "песик"];

    if (catKeywords.some((keyword) => val.includes(keyword))) {
      return "Кошка";
    }

    if (dogKeywords.some((keyword) => val.includes(keyword))) {
      return "Собака";
    }

    return "other";
  };

  const filteredAnimals = animals.filter((animal) => {
    if (activeFilter === "Все") return true;
    if (activeFilter === "Кошки") return getSpeciesType(animal.species) === "Кошка";
    if (activeFilter === "Собаки") return getSpeciesType(animal.species) === "Собака";
    return true;
  });

  const displayedAnimals = filteredAnimals.slice(0, 6);
  const displayedOrganizations = organizations.slice(0, 3);

  const getBadgeText = (status: string, isUrgent: boolean): string => {
    if (isUrgent) return "Срочно!";
    if (status === "looking_for_home") return "Ищет дом";
    if (status === "on_treatment") return "На лечении";
    if (status === "in_shelter") return "В приюте";
    return "Ищет дом";
  };

  const ScrollLink = ({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => {
    const router = useRouter();

    const handleClick = (e: React.MouseEvent) => {
      e.preventDefault();

      window.scrollTo({ top: 0, behavior: "instant" });

      router.push(href);
    };

    return (
      <a href={href} onClick={handleClick} className={className}>
        {children}
      </a>
    );
  };

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.container}>
          <div className={styles.heroLeft}>
            <h1>Соединяем тех, кто ждёт, с теми, кто готов помочь</h1>
            <p>
              Платформа для волонтеров, приютов и всех, кто хочет сделать что-то важное — рядом с домом или онлайн
            </p>
            <div className={styles.heroButtons}>
              <Link href="/catalog/animals" className={styles.primary}>
                Найти питомца
              </Link>
              <Link href="/volunteer" className={styles.secondary}>
                Стать волонтером
              </Link>
            </div>
          </div>
          <div className={styles.heroRight}>
            <img src="/hero.png" alt="" width={454} height={454} fetchPriority="high" decoding="async" />
          </div>
        </div>
      </section>

      <section className={styles.urgent}>
        <div className={styles.container}>
          <div className={styles.header}>
            <h2>Срочно нужна помощь</h2>
          </div>
          <div className={styles.urgentGrid}>
            {bigCard ? (
              <>
                <div className={styles.bigCard}>
                  <div className={styles.bigImageWrapper}>
                    <span className={styles.smallFilter1}>срочно</span>

                    <Link href={`/urgent/${bigCard.id}`} className={styles.bigImage}>
                      <img src={getImageUrl(bigCard.primary_photo_url)} alt={bigCard.title} loading="lazy" />
                    </Link>

                    {getCollectionProgressPercent(bigCard) !== null && (
                      <div className={styles.progressOnImage}>
                        <div className={styles.progressBarWrapper}>
                          <div
                            className={styles.progressBarFill}
                            style={{ width: `${getCollectionProgressPercent(bigCard)}%` }}
                          />
                          <span className={styles.progressText}>{formatRub(bigCard.target_amount)}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className={styles.bigInfo}>
                    <span className={styles.orgName}>{bigCard.organization_name}</span>

                    <h3>{bigCard.title}</h3>
                    <p>{takeFirstSentences(bigCard.description, 1)}</p>

                    <div className={styles.bigActions}>
                      <Link
                        href={isAuth ? `/urgent/${bigCard.id}` : getLoginHref(`/urgent/${bigCard.id}`)}
                        className={styles.helpBtn}
                      >
                        Помочь
                      </Link>
                      <Link href={`/urgent/${bigCard.id}`} className={styles.moreBtn}>
                        Подробнее
                      </Link>
                    </div>
                  </div>
                </div>

                <div className={styles.smallGrid}>
                  {smallCards.map((item: UrgentItem) => (
                    <div key={item.id} className={styles.smallCard}>
                      <span className={styles.smallFilter1}>срочно</span>

                      <Link href={`/urgent/${item.id}`} className={styles.smallImage}>
                        <img src={getImageUrl(item.primary_photo_url)} alt={item.title} loading="lazy" />
                      </Link>

                      <span className={styles.smallFilter}>{getHelpLabel(item.help_type)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p>Срочных заявок сейчас нет.</p>
            )}
          </div>
        </div>
        <Link href="/urgent" className={styles.viewAllBtn}>
          Смотреть все срочные
        </Link>
      </section>

      <section className={styles.helpSection}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>Как вы можете помочь</h2>
          <div className={styles.helpGrid}>
            <div className={styles.helpCard}>
              <div className={styles.helpCardContent}>
                <img src="/help1.svg" alt="" className={styles.helpVolunteer} loading="lazy" />
                <h3>Волонтерство</h3>
                <p>Помогайте приютам с задачами рядом с домом — перевозка, уход, фото, выгул</p>
                <a href="/help" className={styles.helpLink}>
                  Хочу помогать →
                </a>
              </div>
            </div>
            <div className={styles.helpCard}>
              <div className={styles.helpCardContent}>
                <img src="/help2.svg" alt="" className={styles.helpPhoto} loading="lazy" />
                <h3>Передержка</h3>
                <p>Временно приютите питомца, пока он ищет постоянного дома</p>
                <a href="/help" className={styles.helpLink}>
                  Предложить дом →
                </a>
              </div>
            </div>
            <div className={styles.helpCard}>
              <div className={styles.helpCardContent}>
                <img src="/help3.svg" alt="" className={styles.helpPhoto} loading="lazy" />
                <h3>Приютить</h3>
                <p>Найдите питомца, который подойдет именно вам, и заберите его домой навсегда</p>
                <Link href="/catalog/animals" className={styles.helpLink}>
                  Смотреть животных →
                </Link>
              </div>
            </div>
            <div className={styles.helpCard}>
              <div className={styles.helpCardContent}>
                <img src="/help4.svg" alt="" className={styles.helpThings} loading="lazy" />
                <h3>Помочь вещами</h3>
                <p>Корм, лекарства, наполнители или финансовый сбор — каждый вклад важен</p>
                <a href="/help" className={styles.helpLink}>
                  Помочь →
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.homeSection}>
        <div className={styles.container}>
          <div className={styles.homeHeader}>
            <h2>Ищут дом</h2>
            <div className={styles.filters}>
              <button className={activeFilter === "Все" ? styles.active : ""} onClick={() => setActiveFilter("Все")}>
                Все
              </button>
              <button
                className={activeFilter === "Кошки" ? styles.active : ""}
                onClick={() => setActiveFilter("Кошки")}
              >
                Кошки
              </button>
              <button
                className={activeFilter === "Собаки" ? styles.active : ""}
                onClick={() => setActiveFilter("Собаки")}
              >
                Собаки
              </button>
            </div>
          </div>

          {displayedAnimals.length > 0 ? (
            <div className={styles.homeGrid}>
              {displayedAnimals.map((animal) => (
                <div key={animal.id} className={styles.animalCard}>
                  <div className={styles.imageWrapper}>
                    <img
                      src={getImageUrl(animal.primary_photo_url) || "/cat.png"}
                      alt={animal.name}
                      loading="lazy"
                    />
                    <span className={styles.badge}>{getBadgeText(animal.status, animal.is_urgent)}</span>
                  </div>
                  <div className={styles.cardBody}>
                    <h3>{animal.name}</h3>
                    <div className={styles.tags}>
                      <span>{animal.species}</span>
                      <span>{animal.breed || "Метис"}</span>
                      <span>{formatAge(animal.age_months)}</span>
                    </div>
                    <p className={styles.org}>
                      <img src="/org.svg" alt="" className={styles.orgIcon} />
                      {animal.organization_name || "Без организации"}
                    </p>
                    <ScrollLink href={`/catalog/animals/${animal.id}`} className={styles.link}>
                      Познакомиться →
                    </ScrollLink>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.noResults}>
              <p>Животных этого типа пока нет</p>
            </div>
          )}

          <div className={styles.center}>
            <Link href="/catalog/animals" className={styles.showAll}>
              Смотреть все
            </Link>
          </div>
        </div>
      </section>

      <section className={styles.orgSection}>
        <div className={styles.container}>
          <div className={styles.orgHeader}>
            <h2>Организации на платформе</h2>
          </div>

          {displayedOrganizations.length > 0 ? (
            <div className={styles.orgGrid}>
              {displayedOrganizations.map((org) => (
                <div key={org.id} className={styles.orgCard}>
                  <div className={styles.orgTop}>
                    <div className={styles.orgLogo}>
                      <img
                        src={getImageUrl(organizationLogoPath(org)) || "/org-placeholder.png"}
                        alt={org.name}
                        loading="lazy"
                      />
                    </div>
                    <h3>{org.name}</h3>
                  </div>
                  <p>{org.description || "Информация об организации"}</p>
                  <Link href={`/catalog/organizations/${org.id}`} className={styles.orgLink}>
                    Подробнее →
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <p className={styles.loading}>Организаций пока нет.</p>
          )}
        </div>
        <Link href="/catalog/organizations" className={styles.showAllRight}>
          Смотреть все →
        </Link>
      </section>

      <section className={styles.eventsSection}>
        <div className={styles.container}>
          <div className={styles.eventsHeader}>
            <h2>Ближайшие мероприятия</h2>
            <Link href="/events" className={styles.showAllRight}>
              Смотреть все →
            </Link>
          </div>
          <div className={styles.eventsGrid}>
            {homeEvents.length === 0 ? (
              <p>Ближайших мероприятий пока нет.</p>
            ) : (
              homeEvents.map((ev) => (
                <div key={ev.id} className={styles.eventCard}>
                  <img src="/event.png" alt="" loading="lazy" />
                  <div className={styles.eventBody}>
                    <h3>{ev.title}</h3>
                    <p className={styles.eventMeta}>
                      {new Date(ev.starts_at).toLocaleDateString("ru-RU", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                      {ev.city ? ` • ${ev.city}` : ""}
                    </p>
                    <Link href={`/events/${ev.id}`} className={styles.eventLink}>
                      Подробнее →
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {!isAuth && (
        <section className={styles.ctaSection}>
        <div className={styles.container}>
          <div className={styles.ctaBox}>
            <h2>Присоединяйтесь к помощи уже сегодня</h2>
            <p>
              Волонтерство, передержка, помощь вещами или финансовая поддержка - выберите то, что вам ближе.
            </p>
            <div className={styles.ctaButtons}>
              <a href="/register" className={styles.primaryReg}>
                Зарегистрироваться
              </a>
              <a href="/help" className={styles.secondaryHelp}>
                Хочу помогать
              </a>
            </div>
          </div>
        </div>
        </section>
      )}
    </main>
  );
}
