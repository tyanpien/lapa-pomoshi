"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useUser } from "@/shared/lib/hooks/useUser";
import Sidebar from "@/widgets/sidebar/Sidebar";
import styles from "./Header.module.css";

export default function Header() {
  const { isAuth, userAvatar, userName, role } = useUser();
  const [open, setOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [devRole, setDevRole] = useState("guest");

  useEffect(() => {
    const currentRole = localStorage.getItem("userRole") || "guest";
    setDevRole(currentRole);
  }, []);

  const burgerIcon = (open || isHovered) ? "/burger_hover.svg" : "/burger.svg";

  const toggleMenu = () => setOpen(!open);
  const closeMenu = () => setOpen(false);

  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newRole = e.target.value;
    setDevRole(newRole);
    localStorage.setItem("userRole", newRole);
    localStorage.setItem("token", "mock-token");

    if (newRole === "user") {
      localStorage.setItem("userAvatar", "/event.png");
      localStorage.setItem("userName", "Анна Смирнова");
    } else if (newRole === "volunteer") {
      localStorage.setItem("userAvatar", "/event.png");
      localStorage.setItem("userName", "Анна Смирнова");
    } else if (newRole === "organization") {
      localStorage.setItem("userAvatar", "/event.png");
      localStorage.setItem("userName", "Благотворительный фонд");
    } else {
      localStorage.removeItem("userAvatar");
      localStorage.removeItem("userName");
      localStorage.removeItem("token");
    }

    window.location.reload();
  };

  return (
    <header className={styles.header}>
      <div className={styles.container}>
        <Link href="/" className={styles.logo}>
          <img src="/logo.svg" alt="logo" />
        </Link>

        <nav className={styles.nav}>
          <div className={styles.navItem}>
            <div className={styles.dropdown}>
              <div className={styles.dropdownWrapper}>
                <div className={styles.dropdownTrigger}>
                  Каталог
                </div>
                <div className={styles.dropdownMenu}>
                  <Link href="/catalog/animals">Животные</Link>
                  <Link href="/catalog/organizations">Организации</Link>
                  <Link href="/catalog/volunteers">Волонтеры</Link>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.navItem}>
            <Link href="/help">Помочь</Link>
          </div>

          <div className={styles.navItem}>
            <div className={styles.dropdown}>
              <div className={styles.dropdownWrapper}>
                <div className={styles.dropdownTrigger}>
                  Узнать
                </div>
                <div className={styles.dropdownMenu}>
                  <Link href="/knowledge">База знаний</Link>
                  <Link href="/events">Мероприятия</Link>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.navItem}>
            <Link href="/urgent" className={styles.urgent}>
              Срочно
            </Link>
          </div>
        </nav>

        <div className={styles.right}>
          {!isAuth ? (
            <Link href="/login" className={styles.login}>
              <img src="/user.svg" alt="user" />
              Войти
            </Link>
          ) : (
            <>
              <Link href="/profile" className={styles.avatarLink}>
                <img
                  src={userAvatar || "/event.png"}
                  alt={userName || "Аватар"}
                  className={styles.userAvatar}
                />
              </Link>

              <button
                onClick={toggleMenu}
                className={styles.burger}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
              >
                <img src={burgerIcon} alt="menu" />
              </button>
            </>
          )}
        </div>
      </div>
      <Sidebar isOpen={open} onClose={closeMenu} />

      {/* переключатель ролей */}
      {process.env.NODE_ENV === "development" && (
        <div className={styles.devTools}>
          <select value={devRole} onChange={handleRoleChange}>
            <option value="guest">Гость</option>
            <option value="user">Пользователь</option>
            <option value="volunteer">Волонтер</option>
            <option value="organization">Организация</option>
          </select>
        </div>
      )}
    </header>
  );
}
