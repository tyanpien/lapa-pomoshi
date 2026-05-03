"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";

type Application = {
  id: number;
  name: string;
  type: string;
  breed: string;
  age: string;
  organization: string;
  status: string;
};

const applicationsMock: Application[] = [
  {
    id: 1,
    name: "Муся",
    type: "Кошка",
    breed: "Метис",
    age: "2 года",
    organization: "Название организации",
    status: "На рассмотрении",
  },
  {
    id: 2,
    name: "Муся",
    type: "Кошка",
    breed: "Метис",
    age: "2 года",
    organization: "Название организации",
    status: "На рассмотрении",
  },
];

export default function UserApplicationsPage() {
  const [openedMenuId, setOpenedMenuId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredApplications = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return applicationsMock;
    }

    return applicationsMock.filter((item) => item.name.toLowerCase().includes(normalizedQuery));
  }, [searchQuery]);

  useEffect(() => {
    if (openedMenuId === null) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const clickedInsideMenu = target?.closest('[data-card-menu-root="true"]');
      if (!clickedInsideMenu) {
        setOpenedMenuId(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openedMenuId]);

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <section className={styles.headerRow}>
          <h1>Мои анкеты</h1>
          <label className={styles.searchLabel}>
            <span className={styles.searchIcon} aria-hidden="true" />
            <input
              type="text"
              placeholder="Найти"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </label>
        </section>

        <section className={styles.list}>
          {filteredApplications.map((item) => (
            <article className={styles.card} key={item.id}>
              <img src="/cat.png" alt={item.name} className={styles.cardImage} />

              <div className={styles.cardContent}>
                <div className={styles.cardTop}>
                  <div>
                    <h2>{item.name}</h2>
                    <div className={styles.tags}>
                      <span>{item.type}</span>
                      <span>{item.breed}</span>
                      <span>{item.age}</span>
                    </div>
                  </div>

                  <div className={styles.menuWrap} data-card-menu-root="true">
                    <button
                      type="button"
                      className={styles.menuBtn}
                      aria-label="Действия с анкетой"
                      aria-expanded={openedMenuId === item.id}
                      onClick={() => setOpenedMenuId((prev) => (prev === item.id ? null : item.id))}
                    >
                      ⋮
                    </button>

                    {openedMenuId === item.id ? (
                      <div className={styles.menuDropdown}>
                        <Link href={`/catalog/animals/${item.id}`} className={styles.menuLink}>
                          Подробнее
                        </Link>
                        <button type="button" className={styles.menuDelete}>
                          Удалить анкету
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className={styles.cardBottom}>
                  <div className={styles.organization}>
                    <img src="/org.svg" alt="" aria-hidden="true" />
                    <p>{item.organization}</p>
                  </div>
                  <span className={styles.status}>{item.status}</span>
                </div>
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
