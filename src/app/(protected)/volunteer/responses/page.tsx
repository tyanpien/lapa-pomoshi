"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import styles from "./page.module.css";

type ResponseStatus = "На рассмотрении" | "В работе" | "Завершено" | "Отменено" | "Отклонено";
type ResponseFilter = ResponseStatus | "Архив" | "Все";

type ResponseCard = {
  id: number;
  helpType: string;
  organization: string;
  organizationHref: string;
  title: string;
  description: string;
  dateLabel: string;
  status: ResponseStatus;
  urgent?: boolean;
};

type StoredResponse = ResponseCard & {
  sourceTaskId?: number;
};

const responsesStorageKey = "volunteer.responses.v1";

const filterOptions: { label: string; value: ResponseFilter }[] = [
  { label: "На рассмотрении", value: "На рассмотрении" },
  { label: "В работе", value: "В работе" },
  { label: "Завершенные", value: "Завершено" },
  { label: "Архив", value: "Архив" },
  { label: "Все", value: "Все" },
];

const responsesMock: ResponseCard[] = [
  {
    id: 1,
    helpType: "Авто",
    organization: "Фонд «Верный друг»",
    organizationHref: "/catalog/organizations/1",
    title: "Перевозка",
    description:
      "Срочно нужна перевозка кота Василия в ветклинику на ул. Малышева. Требуется аккуратная транспортировка после операции",
    dateLabel: "Сегодня, 17:00",
    status: "На рассмотрении",
    urgent: true,
  },
  {
    id: 2,
    helpType: "Авто",
    organization: "Фонд «Верный друг»",
    organizationHref: "/catalog/organizations/1",
    title: "Перевозка",
    description:
      "Срочно нужна перевозка кота Василия в ветклинику на ул. Малышева. Требуется аккуратная транспортировка после операции",
    dateLabel: "7 мая, 12:00",
    status: "В работе",
  },
  {
    id: 3,
    helpType: "Авто",
    organization: "Фонд «Верный друг»",
    organizationHref: "/catalog/organizations/1",
    title: "Перевозка",
    description:
      "Срочно нужна перевозка кота Василия в ветклинику на ул. Малышева. Требуется аккуратная транспортировка после операции",
    dateLabel: "Сегодня, 17:00",
    status: "Завершено",
  },
  {
    id: 4,
    helpType: "Авто",
    organization: "Фонд «Верный друг»",
    organizationHref: "/catalog/organizations/1",
    title: "Перевозка",
    description:
      "Срочно нужна перевозка кота Василия в ветклинику на ул. Малышева. Требуется аккуратная транспортировка после операции",
    dateLabel: "Сегодня, 17:00",
    status: "Отменено",
  },
  {
    id: 5,
    helpType: "Фото",
    organization: "Центр «Добрые лапы»",
    organizationHref: "/catalog/organizations/2",
    title: "Фотосъёмка",
    description:
      "Нужно сделать фото подопечных для публикации в каталоге. Важно подготовить 8-10 хороших кадров.",
    dateLabel: "10 мая, 14:00",
    status: "Отклонено",
  },
];

const statusClassMap: Record<ResponseStatus, string> = {
  "На рассмотрении": "statusPending",
  "В работе": "statusActive",
  Завершено: "statusDone",
  Отменено: "statusCancelled",
  Отклонено: "statusArchive",
};

export default function VolunteerResponsesPage() {
  const [activeFilter, setActiveFilter] = useState<ResponseFilter>("Все");
  const [savedResponses, setSavedResponses] = useState<ResponseCard[]>([]);
  const [statusOverrides, setStatusOverrides] = useState<Record<number, ResponseStatus>>({});

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const raw = localStorage.getItem(responsesStorageKey);
        if (!raw) {
          return;
        }
        const stored = JSON.parse(raw) as StoredResponse[];
        setSavedResponses(stored);
      } catch {
        setSavedResponses([]);
      }
    });
  }, []);

  const allResponses = useMemo(() => {
    const dedupedMock = responsesMock.filter(
      (item) => !savedResponses.some((saved) => saved.title === item.title && saved.organization === item.organization)
    );
    return [...savedResponses, ...dedupedMock];
  }, [savedResponses]);

  const responsesWithOverrides = useMemo(() => {
    return allResponses.map((item) => ({
      ...item,
      status: statusOverrides[item.id] ?? item.status,
    }));
  }, [allResponses, statusOverrides]);

  const filteredResponses = useMemo(() => {
    if (activeFilter === "Все") {
      return responsesWithOverrides;
    }

    if (activeFilter === "Архив") {
      return responsesWithOverrides.filter((item) => item.status === "Отменено" || item.status === "Отклонено");
    }

    return responsesWithOverrides.filter((item) => item.status === activeFilter);
  }, [activeFilter, responsesWithOverrides]);

  const handleCancelResponse = (id: number) => {
    setStatusOverrides((prev) => ({
      ...prev,
      [id]: "Отменено",
    }));

    const isSavedResponse = savedResponses.some((item) => item.id === id);
    if (!isSavedResponse) {
      return;
    }

    const updatedSaved = savedResponses.map((item) =>
      item.id === id
        ? {
            ...item,
            status: "Отменено" as ResponseStatus,
          }
        : item
    );

    setSavedResponses(updatedSaved);
    try {
      localStorage.setItem(responsesStorageKey, JSON.stringify(updatedSaved));
    } catch {
    }
  };

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <header className={styles.top}>
          <h1>Мои отклики</h1>
          <div className={styles.filters}>
            {filterOptions.map((filter) => (
              <button
                key={filter.value}
                type="button"
                className={`${styles.filterBtn} ${activeFilter === filter.value ? styles.filterBtnActive : ""}`}
                onClick={() => setActiveFilter(filter.value)}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </header>

        <section className={styles.grid}>
          {filteredResponses.map((item) => (
            <article
              key={item.id}
              className={`${styles.card} ${
                item.status === "Отменено" || item.status === "Отклонено" ? styles.cardCancelled : ""
              }`}
            >
              <div className={styles.cardTop}>
                <div className={styles.metaLeft}>
                  <span className={styles.typeTag}>{item.helpType}</span>
                  <Link href={item.organizationHref} className={styles.organization}>
                    {item.organization}
                  </Link>
                </div>
                {item.urgent ? <span className={styles.urgent}>срочно</span> : null}
              </div>

              <h2 className={styles.title}>{item.title}</h2>
              <p className={styles.description}>{item.description}</p>

              <div className={styles.timeRow}>
                <img src="/clock.svg" alt="" aria-hidden="true" />
                <span>{item.dateLabel}</span>
              </div>

              <div className={styles.bottom}>
                <div className={styles.actions}>
                  {item.status !== "Отменено" && item.status !== "Отклонено" ? (
                    <button type="button" className={styles.chatBtn}>
                      Чат
                    </button>
                  ) : null}
                  {item.status === "На рассмотрении" ? (
                    <button type="button" className={styles.secondaryBtn} onClick={() => handleCancelResponse(item.id)}>
                      Отменить отклик
                    </button>
                  ) : null}
                  {item.status === "В работе" ? (
                    <button type="button" className={styles.secondaryBtn}>
                      Отправить отчет
                    </button>
                  ) : null}
                </div>
                <span className={`${styles.status} ${styles[statusClassMap[item.status]]}`}>
                  {item.status}
                </span>
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
