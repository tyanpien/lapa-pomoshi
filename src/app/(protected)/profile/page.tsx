"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useUser } from "@/shared/lib/hooks/useUser";
import styles from "./page.module.css";

const formsMock = [
  { id: 1, name: "Муся", status: "На рассмотрении" },
  { id: 2, name: "Муся", status: "На рассмотрении" },
];

export default function ProfilePage() {
  const { userName } = useUser();
  const [openedMenuId, setOpenedMenuId] = useState<number | null>(null);

  const toggleMenu = (formId: number) => {
    setOpenedMenuId((prevId) => (prevId === formId ? null : formId));
  };

  useEffect(() => {
    if (openedMenuId === null) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const clickedInsideMenu = target?.closest('[data-form-menu-root="true"]');

      if (!clickedInsideMenu) {
        setOpenedMenuId(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [openedMenuId]);

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <section className={styles.userHeader}>
          <div className={styles.avatarPlaceholder} />
          <h1>{userName || "User Name"}</h1>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionTop}>
            <h2>Сообщения</h2>
            <Link href="/messages" className={styles.viewAll}>
              Смотреть все
            </Link>
          </div>

          <div className={styles.messageList}>
            <article className={styles.messageItem}>
              <div className={styles.smallAvatar} />
              <div className={styles.messageMeta}>
                <p>Фонд «Верный друг»</p>
              </div>
              <span className={styles.unread}>3</span>
            </article>

            <article className={styles.messageItem}>
              <div className={styles.smallAvatar} />
              <div className={styles.messageMeta}>
                <p>Фонд «Верный друг»</p>
              </div>
              <span className={styles.unread}>3</span>
            </article>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionTop}>
            <h2>Мои анкеты</h2>
            <Link href="/profile/applications" className={styles.viewAll}>
              Смотреть все
            </Link>
          </div>

          <div className={styles.formsList}>
            {formsMock.map((form) => (
              <article className={styles.formCard} key={form.id}>
                <img src="/cat.png" alt={form.name} className={styles.formImage} />
                <div className={styles.formContent}>
                  <div className={styles.formBody}>
                    <div className={styles.formTitleRow}>
                      <h3>{form.name}</h3>
                      <div className={styles.menuWrap} data-form-menu-root="true">
                        <button
                          className={styles.menuBtn}
                          aria-label="Действия с анкетой"
                          aria-expanded={openedMenuId === form.id}
                          onClick={() => toggleMenu(form.id)}
                          type="button"
                        >
                          ⋮
                        </button>
                        {openedMenuId === form.id && (
                          <div className={styles.menuDropdown}>
                            <Link
                              href={`/forms/${form.id}`}
                              className={styles.menuLink}
                              onClick={() => setOpenedMenuId(null)}
                            >
                              Подробнее
                            </Link>
                            <button
                              type="button"
                              className={styles.menuDelete}
                              onClick={() => setOpenedMenuId(null)}
                            >
                              Удалить анкету
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className={styles.tags}>
                      <span>Кошка</span>
                      <span>Метис</span>
                      <span>2 года</span>
                    </div>
                    <div className={styles.formBottomRow}>
                      <div className={styles.orgAddress}>
                        <img src="/org.svg" alt="адрес" className={styles.orgIcon} />
                        <p className={styles.orgName}>Название организации</p>
                      </div>
                      <span className={styles.status}>{form.status}</span>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
