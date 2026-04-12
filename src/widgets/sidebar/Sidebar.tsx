"use client";

import { useUser } from "@/shared/lib/hooks/useUser";
import { useState, useEffect } from "react";
import styles from "./Sidebar.module.css";
import Link from "next/link";

export default function Sidebar({ isOpen, onClose }: any) {
  const { role } = useUser();

  const [catalogOpen, setCatalogOpen] = useState(false);
  const [animalsOpen, setAnimalsOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('no-scroll');
    } else {
      document.body.classList.remove('no-scroll');
    }

    return () => {
      document.body.classList.remove('no-scroll');
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.sidebar} onClick={(e) => e.stopPropagation()}>

        <Link href="/" className={styles.logo} onClick={onClose}>
          <img src="/logo.svg" alt="logo" />
        </Link>

        <button onClick={onClose} className={styles.closeButton}>
          <img src="/burger_hover.svg" alt="close menu" />
        </button>

        <div className={styles.grid}>
          <div className={styles.column}>
            {role === "user" && (
              <>
                <Link href="/profile" onClick={onClose}>Мой профиль</Link>
                <Link href="/requests" onClick={onClose}>Мои заявки</Link>
                <Link href="/forms" onClick={onClose}>Мои анкеты</Link>
                <Link href="/messages" onClick={onClose}>Мои сообщения</Link>
              </>
            )}

            {role === "volunteer" && (
              <>
                <Link href="/tasks" onClick={onClose} className={styles.urgentLink}>
                  Лента задач
                </Link>
                <Link href="/profile" onClick={onClose}>Мой профиль</Link>
                <Link href="/requests" onClick={onClose}>Мои заявки</Link>
                <Link href="/forms" onClick={onClose}>Мои анкеты</Link>
                <Link href="/responses" onClick={onClose}>Мои отклики</Link>
                <Link href="/messages" onClick={onClose}>Мои сообщения</Link>
              </>
            )}

            {role === "organization" && (
              <>
                <Link href="/org/profile" onClick={onClose}>Профиль</Link>

                <div className={`${styles.dropdownBlock} ${animalsOpen ? styles.active : ""}`}>
                  <div
                    className={styles.dropdownHeader}
                    onClick={() => setAnimalsOpen(!animalsOpen)}
                  >
                    <span className={styles.dropdownTitle}>
                      Подопечные
                      <span className={`${styles.arrow} ${animalsOpen ? styles.open : ""}`}>
                        <img src="/strelka.svg" alt="arrow" />
                      </span>
                    </span>
                  </div>

                  {animalsOpen && (
                    <div className={styles.dropdownContent}>
                      <Link href="/org/home-hello" onClick={onClose}>
                        Привет из дома
                      </Link>
                      <Link href="/org/animals" onClick={onClose}>
                        Животные
                      </Link>
                    </div>
                  )}
                </div>

                <Link href="/org/requests" onClick={onClose}>Заявки</Link>
                <Link href="/messages" onClick={onClose}>Сообщения</Link>
                <Link href="/org/reports" onClick={onClose}>Отчеты</Link>
                <Link href="/org/articles" onClick={onClose}>Статьи</Link>
                <Link href="/org/events" onClick={onClose}>Мои мероприятия</Link>
              </>
            )}
          </div>

          <div className={styles.column}>
            <Link href="/urgent" onClick={onClose} className={styles.urgentLink}>
              Срочно
            </Link>

            <div className={`${styles.dropdownBlock} ${catalogOpen ? styles.active : ""}`}>
              <div
                className={styles.dropdownHeader}
                onClick={() => setCatalogOpen(!catalogOpen)}
              >
                <span className={styles.dropdownTitle}>
                  Каталог
                  <span className={`${styles.arrow} ${catalogOpen ? styles.open : ""}`}>
                    <img src="/strelka.svg" alt="arrow" />
                  </span>
                </span>
              </div>

              {catalogOpen && (
                <div className={styles.dropdownContent}>
                  <Link href="/catalog/organizations" onClick={onClose}>
                    Организации
                  </Link>
                  <Link href="/catalog/animals" onClick={onClose}>
                    Животные
                  </Link>
                  <Link href="/catalog/volunteers" onClick={onClose}>
                    Волонтеры
                  </Link>
                </div>
              )}
            </div>

            <Link href="/help" onClick={onClose}>Помочь</Link>
            <Link href="/knowledge" onClick={onClose}>База знаний</Link>
            <Link href="/events" onClick={onClose}>Мероприятия</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
