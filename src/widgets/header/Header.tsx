"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useUser } from "@/shared/lib/hooks/useUser";
import Sidebar from "@/widgets/sidebar/Sidebar";
import styles from "./Header.module.css";

export default function Header() {
  const { isAuth, userAvatar, userName, role } = useUser();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const burgerIcon = (open || isHovered) ? "/burger_hover.svg" : "/burger.svg";

  const toggleMenu = () => setOpen(!open);
  const closeMenu = () => setOpen(false);

  const getProfileHref = () => {
    if (role === "volunteer") return "/volunteer/profile";
    if (role === "organization") return "/organization/profile";
    return "/profile";
  };

  const showAuthedUi = mounted && isAuth;

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
          {!showAuthedUi ? (
            <Link href="/login" className={styles.login}>
              <img src="/user.svg" alt="user" />
              Войти
            </Link>
          ) : (
            <>
              <Link href={getProfileHref()} className={styles.avatarLink}>
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
    </header>
  );
}
