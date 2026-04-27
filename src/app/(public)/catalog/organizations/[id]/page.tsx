/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import styles from "./page.module.css";
import { organizationsApi, Organization } from "@/shared/api/endpoints/organizations";
import { getImageUrl } from "@/shared/api/client";

type PageProps = {
  params: Promise<{ id: string }>;
};

type AnimalCard = {
  id: number;
  name: string;
  breed: string;
  age: string;
  location: string;
  image: string;
  status: string;
};

type HelpRequest = {
  id: number;
  title: string;
  description: string;
  amount: string;
  progress: number;
};

type EventCard = {
  id: number;
  title: string;
  date: string;
  place: string;
  image: string;
};

type HomeStory = {
  id: number;
  animalName: string;
  text: string;
  image: string;
};

type ReportFile = {
  id: number;
  title: string;
  href: string;
};

const tabs = [
  { key: "wards", label: "Подопечные" },
  { key: "about", label: "О нас" },
  { key: "help", label: "Чем помочь" },
  { key: "events", label: "Мероприятия" },
  { key: "home", label: "Привет из дома" },
  { key: "reports", label: "Отчеты" },
] as const;

type TabKey = (typeof tabs)[number]["key"];

const animalsMock: AnimalCard[] = [
  { id: 1, name: "Муся", breed: "Собака", age: "2 года", location: "Название организации", image: "/dogs.png", status: "Готова к пристройству" },
  { id: 2, name: "Муся", breed: "Собака", age: "2 года", location: "Название организации", image: "/dogs.png", status: "Готова к пристройству" },
  { id: 3, name: "Муся", breed: "Собака", age: "2 года", location: "Название организации", image: "/dogs.png", status: "Готова к пристройству" },
  { id: 4, name: "Муся", breed: "Собака", age: "2 года", location: "Название организации", image: "/dogs.png", status: "Готова к пристройству" },
  { id: 5, name: "Муся", breed: "Собака", age: "2 года", location: "Название организации", image: "/dogs.png", status: "Готова к пристройству" },
  { id: 6, name: "Муся", breed: "Собака", age: "2 года", location: "Название организации", image: "/dogs.png", status: "Готова к пристройству" },
];

const helpRequests: HelpRequest[] = [
  {
    id: 1,
    title: "Сбор на корм",
    description: "Нужен запас корма на 2 месяца для собак в стационаре.",
    amount: "Нужно 120 000 ₽",
    progress: 68,
  },
  {
    id: 2,
    title: "Сбор на лечение",
    description: "Оплата операций и диагностики для 5 подопечных после травм.",
    amount: "Нужно 85 000 ₽",
    progress: 41,
  },
  {
    id: 3,
    title: "Теплые вольеры",
    description: "Покупка утеплителей и материалов перед зимним сезоном.",
    amount: "Нужно 60 000 ₽",
    progress: 24,
  },
];

const events: EventCard[] = [
  { id: 1, title: "День открытых дверей", date: "12 мая 2026", place: "Приют Верный друг", image: "/event.png" },
  { id: 2, title: "Благотворительный маркет", date: "26 мая 2026", place: "Центр города", image: "/event.png" },
  { id: 3, title: "Урок доброты в школе", date: "3 июня 2026", place: "Школа №18", image: "/event.png" },
];

const homeStories: HomeStory[] = [
  {
    id: 1,
    animalName: "Рэй",
    text: "Рэй уже 4 месяца живет в новой семье, освоился и обожает долгие прогулки у озера.",
    image: "/dogs.png",
  },
  {
    id: 2,
    animalName: "Боня",
    text: "Боня быстро подружилась с котом и каждый вечер встречает хозяев у двери.",
    image: "/dogs.png",
  },
];

const reports: ReportFile[] = [
  { id: 1, title: "Финансовый отчет за 1 квартал 2026", href: "#" },
  { id: 2, title: "Отчет по пристройству животных за 2025", href: "#" },
  { id: 3, title: "Отчет о целевом использовании пожертвований", href: "#" },
];

export default function OrganizationPage({ params }: PageProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("wards");
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadOrganization = async () => {
      try {
        const { id } = await params;
        const data = await organizationsApi.getById(Number(id));
        if (mounted) {
          setOrganization(data);
        }
      } catch (error) {
        console.error("Не удалось загрузить организацию:", error);
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
  }, [params]);

  const orgName = organization?.name || 'Благотворительный фонд  «Верный друг»';
  const orgAddress = organization?.address || "г. Екатеринбург и Свердловская область";
  const orgDescription =
    organization?.description ||
    "Мы спасаем крупных собак, пострадавших от жестокого обращения или ДТП. Лечим, социализируем и находим им новые семьи. Под нашей опекой сейчас находится 150 хвостиков.";
  const orgLogo = getImageUrl(organization?.logo) || "/event.png";

  const animals = useMemo(
    () => animalsMock.map((item) => ({ ...item, location: orgName })),
    [orgName]
  );

  const renderTabContent = () => {
    if (activeTab === "about") {
      return (
        <section className={styles.contentBlock} aria-label="О нас">
          <h2 className={styles.blockTitle}>О фонде</h2>
          <p>
            Фонд основан в 2017 году командой волонтеров и ветеринарных врачей. Основная миссия - помощь бездомным
            и пострадавшим животным, реабилитация и поиск ответственных семей.
          </p>
          <p>{orgDescription}</p>
          <p>
            Сейчас в команде более 40 постоянных волонтеров, кураторы по пристройству, ветеринарные партнеры и
            психологи по адаптации животных в новых семьях.
          </p>
        </section>
      );
    }

    if (activeTab === "help") {
      return (
        <section className={styles.contentGrid} aria-label="Чем помочь">
          {helpRequests.map((request) => (
            <article className={styles.infoCard} key={request.id}>
              <h3>{request.title}</h3>
              <p>{request.description}</p>
              <p className={styles.amount}>{request.amount}</p>
              <progress className={styles.progressTrack} max={100} value={request.progress}>
                {request.progress}%
              </progress>
              <button type="button" className={styles.primaryButton}>
                Помочь сбору
              </button>
            </article>
          ))}
        </section>
      );
    }

    if (activeTab === "events") {
      return (
        <section className={styles.contentGrid} aria-label="Мероприятия">
          {events.map((event) => (
            <article className={styles.infoCard} key={event.id}>
              <img src={event.image} alt={event.title} className={styles.eventImage} />
              <h3>{event.title}</h3>
              <p>{event.date}</p>
              <p>{event.place}</p>
              <button type="button" className={styles.secondaryButton}>
                Узнать подробнее
              </button>
            </article>
          ))}
        </section>
      );
    }

    if (activeTab === "home") {
      return (
        <section className={styles.contentGrid} aria-label="Привет из дома">
          {homeStories.map((story) => (
            <article className={styles.infoCard} key={story.id}>
              <img src={story.image} alt={story.animalName} className={styles.eventImage} />
              <h3>{story.animalName}</h3>
              <p>{story.text}</p>
            </article>
          ))}
        </section>
      );
    }

    if (activeTab === "reports") {
      return (
        <section className={styles.contentBlock} aria-label="Отчеты">
          <h2 className={styles.blockTitle}>Документы и отчеты</h2>
          <ul className={styles.reportList}>
            {reports.map((item) => (
              <li key={item.id}>
                <a href={item.href} className={styles.reportLink}>
                  {item.title}
                </a>
              </li>
            ))}
          </ul>
        </section>
      );
    }

    return (
      <section className={styles.cardsSection} aria-label="Подопечные организации">
        <div className={styles.cardsGrid}>
          {animals.map((animal) => (
            <article className={styles.card} key={animal.id}>
              <div className={styles.imageWrap}>
                <img src={animal.image} alt={animal.name} className={styles.image} />
                <span className={styles.badge}>{animal.status}</span>
              </div>

              <div className={styles.cardBody}>
                <h2 className={styles.cardTitle}>{animal.name}</h2>
                <p className={styles.meta}>
                  <span>{animal.breed}</span>
                  <span>{animal.age}</span>
                </p>
                <p className={styles.location}>
                  <img src="/org.svg" alt="" className={styles.locationIcon} />
                  {animal.location}
                </p>
                <button type="button" className={styles.primaryButton}>
                  Забрать домой
                </button>
              </div>
            </article>
          ))}
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
          <p className={styles.organizationSubtitle}>Помощь собакам крупного размера и собакам-инвалидам</p>
        </div>

        <div className={styles.organizationGrid}>
          <article className={styles.organizationDescription}>
            <p>{orgDescription}</p>
            <address className={styles.contacts}>
              <p className={styles.addressRow}>
                <img src="/org.svg" alt="" aria-hidden="true" className={styles.inlineIcon} />
                {orgAddress}
              </p>
              <p className={styles.contact}>+7 (999) 123-45-67, info@vernydrug.org.ru</p>
              <p>
                <a href="#" className={styles.link}>
                  [Иконка Telegram]
                </a>{" "}
                <a href="#" className={styles.link}>
                  [Иконка VK]
                </a>
              </p>
            </address>
          </article>

          <div className={styles.statsColumn}>
            <aside className={styles.statsCard} aria-label="Статистика фонда">
              <p>
                {organization?.wards_count ?? 150} подопечных
              </p>
              <p>
                {organization?.adopted_yearly_count ?? 47} пристроено за год
              </p>
            </aside>

            <nav className={styles.infoLinks} aria-label="Полезные ссылки">
              <Link href="#" className={styles.infoLink}>
                <img src="/info.svg" alt="" aria-hidden="true" className={styles.infoIcon} />
                Правила приема животных
              </Link>
              <Link href="#" className={styles.infoLink}>
                <img src="/info.svg" alt="" aria-hidden="true" className={styles.infoIcon} />
                Как забрать собаку домой
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
