"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import styles from "./page.module.css";
import { organizationsApi, Organization } from "@/shared/api/endpoints/organizations";
import { getOrganizationAnimalsByName } from "@/shared/lib/organizationAnimals";
import {
  getOrganizationCabinetEventName,
  getOrganizationCabinetRecordByName,
} from "@/shared/lib/organizationCabinet";
import { getImageUrl } from "@/shared/api/client";

const tabs = [
  { key: "wards", label: "Подопечные" },
  { key: "about", label: "О нас" },
  { key: "help", label: "Чем помочь" },
  { key: "events", label: "Мероприятия" },
  { key: "home", label: "Привет из дома" },
  { key: "articles", label: "Статьи" },
  { key: "reports", label: "Отчеты" },
] as const;

type TabKey = (typeof tabs)[number]["key"];

export default function OrganizationPage() {
  const params = useParams<{ id: string }>();
  const organizationId = Number(params?.id);
  const [activeTab, setActiveTab] = useState<TabKey>("wards");
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [organizationNameFromRecord, setOrganizationNameFromRecord] = useState("");
  const [cabinetTick, setCabinetTick] = useState(0);

  useEffect(() => {
    const eventName = getOrganizationCabinetEventName();
    const bump = () => setCabinetTick((t) => t + 1);
    window.addEventListener(eventName, bump);
    return () => window.removeEventListener(eventName, bump);
  }, []);

  useEffect(() => {
    if (!Number.isFinite(organizationId)) {
      setOrganization(null);
      setLoading(false);
      return;
    }

    let mounted = true;

    const loadOrganization = async () => {
      try {
        const listData = await organizationsApi.getList();
        const fromList = (listData?.items ?? []).find((item: Organization) => item.id === organizationId) ?? null;

        let resolved = fromList;
        try {
          const byId = await organizationsApi.getById(organizationId);
          if (byId?.id === organizationId) {
            resolved = {
              ...(fromList || {}),
              ...byId,
            };
          }
        } catch {
          
        }

        if (mounted) {
          setOrganization(resolved);
          setNotFound(!resolved);
          setOrganizationNameFromRecord(resolved?.name || "");
        }
      } catch (error) {
        console.error("Не удалось загрузить организацию:", error);
        if (mounted) {
          setOrganization(null);
          setNotFound(true);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadOrganization();
    return () => {
      mounted = false;
    };
  }, [organizationId]);

  const cabinetRecord = useMemo(() => {
    void cabinetTick;
    if (!organizationNameFromRecord) return null;
    return getOrganizationCabinetRecordByName(organizationNameFromRecord);
  }, [organizationNameFromRecord, cabinetTick]);

  const organizationAnimals = useMemo(() => {
    if (!organizationNameFromRecord) return [];
    return getOrganizationAnimalsByName(organizationNameFromRecord);
  }, [organizationNameFromRecord]);

  const orgName =
    cabinetRecord?.profile.organizationName.trim() || organization?.name || "Организация";
  const orgAddress = organization?.address || "Адрес не указан";
  const orgDescription =
    cabinetRecord?.profile.description || cabinetRecord?.profile.helpWays || organization?.description || "Описание пока не заполнено.";
  const orgLogo = getImageUrl(organization?.logo) || "/event.png";
  const organizationRequests = cabinetRecord?.requests ?? [];
  const organizationEvents = cabinetRecord?.events ?? [];
  const organizationGreetings = cabinetRecord?.greetingsFromHome ?? [];
  const organizationReports = cabinetRecord?.reports ?? [];
  const organizationArticles = (cabinetRecord?.articles ?? []).filter((article) => !article.archived);
  const adoptedYearlyCount = organizationGreetings.length || organization?.adopted_yearly_count || 0;

  const formatAge = (months: number) => {
    if (!months) return "Возраст не указан";
    if (months < 12) return `${months} мес.`;
    const years = Math.floor(months / 12);
    return `${years} ${years === 1 ? "год" : years < 5 ? "года" : "лет"}`;
  };

  const getAnimalStatus = (status: string) => {
    if (status === "looking_for_home") return "Ищет дом";
    if (status === "on_treatment") return "На лечении";
    return "В приюте";
  };

  const getRequestStatusLabel = (status: string) => {
    if (status === "published") return "опубликована";
    if (status === "in_progress") return "в работе";
    if (status === "closed") return "закрыта";
    return "черновик";
  };

  const renderTabContent = () => {
    if (activeTab === "about") {
      return (
        <section className={styles.contentBlock} aria-label="О нас">
          <h2 className={styles.blockTitle}>О фонде</h2>
          <p>{orgDescription}</p>
          <p>{cabinetRecord?.profile.specialization || "Специализация пока не указана."}</p>
          <p>{cabinetRecord?.profile.admissionRules || "Правила приема животных пока не заполнены."}</p>
        </section>
      );
    }

    if (activeTab === "help") {
      return (
        <section className={styles.helpList} aria-label="Чем помочь">
          {organizationRequests.length === 0 ? (
            <article className={styles.helpEmptyCard}>
              <p>Заявок на помощь пока нет.</p>
            </article>
          ) : (
            organizationRequests.map((request) => {
              const linkedAnimal = request.linkedAnimalId
                ? organizationAnimals.find((animal) => animal.id === request.linkedAnimalId)
                : null;
              const imageSrc = request.mediaUrl?.trim() || linkedAnimal?.primary_photo_url || "/cat-placeholder.jpg";

              return (
                <article key={request.id} className={styles.helpRequestCard}>
                  <div className={styles.helpCover}>
                    <img src={imageSrc} alt={request.title} />
                    {request.urgency === "urgent" ? <span className={styles.helpUrgentBadge}>срочно</span> : null}
                  </div>

                  <div className={styles.helpRequestBody}>
                    <h3 className={styles.helpRequestName}>{request.title}</h3>
                    <div className={styles.helpTags}>
                      <span>{request.helpType}</span>
                      {request.needVolunteer ? <span>Нужен волонтер</span> : null}
                      <span>{request.location || "Локация не указана"}</span>
                    </div>
                    <p className={styles.helpOrganizationLine}>{request.problemDescription}</p>
                    <p className={styles.helpMetaLine}>Статус: {getRequestStatusLabel(request.status)}</p>
                  </div>
                </article>
              );
            })
          )}
        </section>
      );
    }

    if (activeTab === "events") {
      return (
        <section className={styles.contentGrid} aria-label="Мероприятия">
          {organizationEvents.length === 0 ? (
            <article className={styles.infoCard}>
              <p>Мероприятий пока нет.</p>
            </article>
          ) : (
            organizationEvents.map((event) => (
              <article className={styles.infoCard} key={event.id}>
                <img src="/event.png" alt={event.title} className={styles.eventImage} />
                <h3>{event.title}</h3>
                <p>{event.dateLabel}</p>
                <p>{event.location}</p>
              </article>
            ))
          )}
        </section>
      );
    }

    if (activeTab === "home") {
      return (
        <section className={styles.homeList} aria-label="Привет из дома">
          {organizationGreetings.length === 0 ? (
            <article className={styles.homeEmptyCard}>
              <p>Публикаций пока нет.</p>
            </article>
          ) : (
            organizationGreetings.map((story) => (
              <article className={styles.homeRequestCard} key={story.id}>
                <div className={styles.homeCover}>
                  <img src={story.photoUrl || "/cat-placeholder.jpg"} alt={story.petName} />
                </div>
                <div className={styles.homeRequestBody}>
                  <h3 className={styles.homeRequestName}>{story.petName}</h3>
                  <div className={styles.homeTags}>
                    <span>Привет из дома</span>
                    {story.linkedAnimalId ? (
                      <span>
                        Животное: {organizationAnimals.find((animal) => animal.id === story.linkedAnimalId)?.name || "не указано"}
                      </span>
                    ) : null}
                  </div>
                  <p className={styles.homeOrganizationLine}>{story.text}</p>
                  <p className={styles.homeMetaLine}>
                    {new Date(story.createdAt).toLocaleDateString("ru-RU", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </article>
            ))
          )}
        </section>
      );
    }

    if (activeTab === "articles") {
      return (
        <section className={styles.homeList} aria-label="Статьи организации">
          {organizationArticles.length === 0 ? (
            <article className={styles.homeEmptyCard}>
              <p>Статей пока нет.</p>
            </article>
          ) : (
            organizationArticles.map((article) => {
              const coverSrc = article.coverUrl?.trim()
                ? getImageUrl(article.coverUrl)
                : "/cat-placeholder.jpg";

              return (
                <article className={styles.homeRequestCard} key={article.id}>
                  <div className={styles.homeCover}>
                    <img src={coverSrc} alt="" />
                  </div>
                  <div className={styles.homeRequestBody}>
                    <h3 className={styles.homeRequestName}>{article.title}</h3>
                    <div className={styles.homeTags}>
                      <span>{article.articleType}</span>
                      <span>{article.author}</span>
                    </div>
                    <p className={`${styles.homeOrganizationLine} ${styles.articleExcerpt}`}>{article.content}</p>
                    <p className={styles.homeMetaLine}>
                      {new Date(article.createdAt).toLocaleDateString("ru-RU", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                </article>
              );
            })
          )}
        </section>
      );
    }

    if (activeTab === "reports") {
      return (
        <section className={styles.contentBlock} aria-label="Отчеты">
          <h2 className={styles.blockTitle}>Документы и отчеты</h2>
          <ul className={styles.reportList}>
            {organizationReports.length === 0 ? (
              <li>Отчеты пока не добавлены.</li>
            ) : (
              organizationReports.map((item) => (
                <li key={item.id}>
                  <span className={styles.reportLink}>{item.title}</span>
                </li>
              ))
            )}
          </ul>
        </section>
      );
    }

    return (
      <section className={styles.cardsSection} aria-label="Подопечные организации">
        <div className={styles.cardsGrid}>
          {organizationAnimals.length === 0 ? (
            <article className={styles.infoCard}>
              <p>Подопечные пока не добавлены.</p>
            </article>
          ) : (
            organizationAnimals.map((animal) => (
              <article className={styles.card} key={animal.id}>
                <div className={styles.imageWrap}>
                  <img src={animal.primary_photo_url || "/cat-placeholder.jpg"} alt={animal.name} className={styles.image} />
                  <span className={styles.badge}>{getAnimalStatus(animal.status)}</span>
                </div>

                <div className={styles.cardBody}>
                  <h2 className={styles.cardTitle}>{animal.name}</h2>
                  <p className={styles.meta}>
                    <span>{animal.breed || "Метис"}</span>
                    <span>{formatAge(animal.age_months)}</span>
                  </p>
                  <p className={styles.location}>
                    <img src="/org.svg" alt="" className={styles.locationIcon} />
                    {animal.location_city || orgAddress}
                  </p>
                  <Link href={`/catalog/animals/${animal.id}`} className={styles.primaryButton}>
                    Подробнее
                  </Link>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    );
  };

  if (loading) {
    return (
      <main className={styles.page}>
        <section className={styles.loadingWrap}>
          <p className={styles.loadingText}>Загрузка карточки организации...</p>
        </section>
      </main>
    );
  }

  if (notFound) {
    return (
      <main className={styles.page}>
        <section className={styles.loadingWrap}>
          <p className={styles.loadingText}>Организация не найдена.</p>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroBanner} />
        <img src={orgLogo} alt={orgName} className={styles.heroAvatarImage} />
      </header>

      <section className={styles.organizationSection} aria-labelledby="organization-title">
        <div className={styles.organizationHeader}>
          <h1 id="organization-title" className={styles.organizationTitle}>
            {orgName}
          </h1>
          <p className={styles.organizationSubtitle}>
            {cabinetRecord?.profile.specialization || "Организация помощи животным"}
          </p>
        </div>

        <div className={styles.organizationGrid}>
          <article className={styles.organizationDescription}>
            <p>{orgDescription}</p>
            <address className={styles.contacts}>
              <p className={styles.addressRow}>
                <img src="/org.svg" alt="" aria-hidden="true" className={styles.inlineIcon} />
                {cabinetRecord?.profile.territory || orgAddress}
              </p>
              <p className={styles.contact}>{cabinetRecord?.profile.contacts || "Контакты не указаны"}</p>
              <div className={styles.socialLinks} aria-label="Социальные сети">
                {cabinetRecord?.profile.vkUrl ? (
                  <a href={cabinetRecord.profile.vkUrl} target="_blank" rel="noreferrer" className={styles.socialLink}>
                    VK
                  </a>
                ) : null}
                {cabinetRecord?.profile.telegramUrl ? (
                  <a
                    href={cabinetRecord.profile.telegramUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={styles.socialLink}
                  >
                    TG
                  </a>
                ) : null}
                {cabinetRecord?.profile.whatsappUrl ? (
                  <a
                    href={cabinetRecord.profile.whatsappUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={styles.socialLink}
                  >
                    WA
                  </a>
                ) : null}
              </div>
              <p>
                {cabinetRecord?.profile.adoptionScenario ||
                  cabinetRecord?.profile.adoptionQuestionnaire ||
                  "Сценарий пристроя не заполнен"}
              </p>
            </address>
          </article>

          <div className={styles.statsColumn}>
            <aside className={styles.statsCard} aria-label="Статистика фонда">
              <p>
                <img src="/lapa-org.svg" alt="" aria-hidden="true" className={styles.statIcon} />
                {organizationAnimals.length || organization?.wards_count || 0} подопечных
              </p>
              <p>
                <img src="/home-org.svg" alt="" aria-hidden="true" className={styles.statIcon} />
                {adoptedYearlyCount} пристроено за год
              </p>
            </aside>

            <nav className={styles.infoLinks} aria-label="Полезные ссылки">
              <Link href="#" className={styles.infoLink}>
                <img src="/info.svg" alt="" aria-hidden="true" className={styles.infoIcon} />
                {cabinetRecord?.profile.admissionRules || "Правила приема животных"}
              </Link>
              <Link href="#" className={styles.infoLink}>
                <img src="/info.svg" alt="" aria-hidden="true" className={styles.infoIcon} />
                {cabinetRecord?.profile.adoptionRules || "Как забрать животное домой"}
              </Link>
            </nav>
          </div>
        </div>
      </section>

      <nav className={styles.tabs} aria-label="Разделы организации">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`${styles.tab} ${activeTab === tab.key ? styles.tabActive : ""}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {renderTabContent()}
    </main>
  );
}
