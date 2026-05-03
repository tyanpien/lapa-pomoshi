"use client";
import Link from "next/link";
import styles from "./Footer.module.css";

export default function Footer() {
  return (
     <footer className={styles.footer}>
        <div className={styles.container}>
          <div className={styles.footerGrid}>
            <div className={styles.footerCol}>
              <img src="/logo.svg" className={styles.footerLogo} alt="Logo" />
              <p className={styles.footerAbout}>
                Платформа помощи животным, объединяющая людей и организации для общей цели - дать дом каждому питомцу.
              </p>
            </div>

            <div className={styles.footerCol}>
              <h4>Навигация</h4>
              <Link href="/catalog/animals">Животные</Link>
              <Link href="/catalog/organizations">Организации</Link>
              <Link href="/catalog/volunteers">Волонтеры</Link>
              <Link href="/events">Мероприятия</Link>
            </div>

            <div className={styles.footerCol}>
              <h4>Помощь</h4>
              <Link href="/help">Как помочь</Link>
              <Link href="/urgent">Срочные сборы</Link>
              <Link href="/knowledge">База знаний</Link>
              <Link href="/volunteer">Стать волонтером</Link>
            </div>

            <div className={styles.footerCol}>
              <h4>Контакты</h4>
              <p className={styles.footerContact}>info@lapapomoshi.ru</p>
              <p className={styles.footerContact}>8 (800) 555 35 35</p>
            </div>
          </div>

          <div className={styles.footerBottom}>
            <p>© 2026 Лапа Помощи</p>
          </div>
        </div>
      </footer>
  )
}
