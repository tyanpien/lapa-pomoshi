"use client";
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
              <a href="/">Главная</a>
              <a href="/catalog/animals">Животные</a>
              <a href="/catalog/organizations">Организации</a>
              <a href="/catalog/volunteers">Волонтеры</a>
              <a href="/events">Мероприятия</a>
            </div>

            <div className={styles.footerCol}>
              <h4>Помощь</h4>
              <a href="/help">Как помочь</a>
              <a href="/urgent">Срочные сборы</a>
              <a href="/knowledge">База знаний</a>
              <a href="/volunteer">Стать волонтером</a>
              <a href="/foster">Передержка</a>
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
